import { DatabaseSync } from 'node:sqlite'
import { createHash, randomBytes, scryptSync } from 'node:crypto'
import { readFile, mkdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import sharp from 'sharp'

const root = resolve(import.meta.dirname, '..')
const dataDir = process.env.SKINCHECK_DATA_DIR ? resolve(process.env.SKINCHECK_DATA_DIR) : join(root, '.data')
const modelDir = resolve(root, '../skincheck-model')
const email = 'skinsafeapp@local.test'
const username = 'skinsafeapp'
const password = 'skinsafe'
const userId = createHash('sha256').update('skinsafeapp-local-video-account').digest('hex').slice(0, 32)
const skinTypes = [
  'I — Always burns, never tans',
  'II — Usually burns, tans a little',
  'III — Sometimes burns, gradually tans',
  'IV — Rarely burns, tans easily',
  'V — Very rarely burns, tans deeply',
  'VI — Never burns, deeply pigmented',
]
const latestAnswers = {
  age:'59', region:'Back', diameter1:'4.0', diameter2:'3.0', itch:'No', growth:'Not sure',
  pain:'No', change:'Not sure', bleeding:'No', elevation:'No', gender:'Female',
  skinType:skinTypes[1], priorSkinCancer:'No', priorCancer:'Yes',
}

function csvRow(line) {
  const out = []
  let value = '', quoted = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"' && quoted && line[i+1] === '"') { value += '"'; i++ }
    else if (c === '"') quoted = !quoted
    else if (c === ',' && !quoted) { out.push(value); value = '' }
    else value += c
  }
  out.push(value)
  return out
}
function yesNo(value) { return String(value).toLowerCase() === 'true' ? 'Yes' : 'No' }
function answersFor(row) {
  const type = Math.round(Number(row.fitspatrick))
  return {
    age:row.age, region:row.region[0]+row.region.slice(1).toLowerCase(),
    diameter1:row.diameter_1, diameter2:row.diameter_2,
    itch:yesNo(row.itch), growth:yesNo(row.grew), pain:yesNo(row.hurt),
    change:yesNo(row.changed), bleeding:yesNo(row.bleed), elevation:yesNo(row.elevation),
    gender:row.gender[0]+row.gender.slice(1).toLowerCase(), skinType:skinTypes[type-1],
    priorSkinCancer:yesNo(row.skin_cancer_history), priorCancer:yesNo(row.cancer_history),
  }
}

await mkdir(dataDir,{recursive:true})
const db = new DatabaseSync(join(dataDir,'skincheck.sqlite'))
db.exec(`PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, salt TEXT NOT NULL, password_hash TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS spot_records (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, photo BLOB NOT NULL, mime TEXT NOT NULL, answers TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS spot_records_user_date ON spot_records(user_id, created_at DESC);`)
const current = db.prepare('SELECT id FROM users WHERE email=?').get(email)
if (current && current.id !== userId) throw new Error('A separate account already uses the reserved local video email; no data was changed.')
if (!current) {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password,Buffer.from(salt,'hex'),64,{N:32768,r:8,p:3,maxmem:64*1024*1024}).toString('hex')
  db.prepare('INSERT INTO users (id,name,email,salt,password_hash,created_at) VALUES (?,?,?,?,?,?)').run(userId,'Aarav',email,salt,hash,new Date().toISOString())
}

const lines = (await readFile(join(modelDir,'data/metadata.csv'),'utf8')).trim().split(/\r?\n/)
const headers = csvRow(lines.shift())
const rows = lines.map(line=>Object.fromEntries(csvRow(line).map((value,index)=>[headers[index],value])))
const required = ['age','gender','fitspatrick','region','diameter_1','diameter_2','skin_cancer_history','cancer_history','itch','grew','hurt','changed','bleed','elevation','img_id']
const chosen = [], patients = new Set()
for (const label of ['NEV','BCC','SCC','ACK','SEK','MEL']) {
  let count = 0
  for (const row of rows) {
    if (row.diagnostic !== label || row.img_id === 'PAT_847_1610_165.png' || row.img_id === 'PAT_917_1735_936.png' || patients.has(row.patient_id) || required.some(key=>!row[key])) continue
    const type = Math.round(Number(row.fitspatrick))
    if (type < 1 || type > 6) continue
    chosen.push(row); patients.add(row.patient_id); count++
    if (count === 4) break
  }
  if (count !== 4) throw new Error(`Not enough complete ${label} records to prepare the history.`)
}
const put = db.prepare('INSERT OR IGNORE INTO spot_records (id,user_id,photo,mime,answers,created_at) VALUES (?,?,?,?,?,?)')
let inserted = 0
for (let i = 0; i < chosen.length; i++) {
  const row = chosen[i]
  const source = join(modelDir,'data/images',row.img_id)
  const photo = await sharp(source).resize({width:640,height:640,fit:'inside',withoutEnlargement:true}).jpeg({quality:72}).toBuffer()
  const id = createHash('sha256').update(`skinsafe-history-${row.img_id}`).digest('hex').slice(0,32)
  const createdAt = new Date(Date.now()-(chosen.length-i)*24*60*60*1000).toISOString()
  inserted += Number(put.run(id,userId,photo,'image/jpeg',JSON.stringify(answersFor(row)),createdAt).changes)
}
const latest = await readFile(join(root,'samples/01-nevus.jpg'))
inserted += Number(put.run('00000000-0000-4000-8000-000000000001',userId,latest,'image/jpeg',JSON.stringify(latestAnswers),new Date().toISOString()).changes)
const count = db.prepare('SELECT COUNT(*) AS count FROM spot_records WHERE user_id=?').get(userId).count
db.close()
console.log(`Local account ${username} is ready with ${count} saved records (${inserted} added).`)
