import { DatabaseSync } from 'node:sqlite'
import { createHash } from 'node:crypto'
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const modelDir = resolve(root, '../skincheck-model')
const output = join(root, 'public/judge')
const images = join(output, 'images')
const db = new DatabaseSync(join(root, '.data/skincheck.sqlite'), { readOnly: true })
const account = db.prepare('SELECT id FROM users WHERE email=?').get('skinsafeapp@local.test')
if (!account) throw new Error('The sample-only SkinSafe account has not been seeded.')

function csvRow(line) {
  const values=[]; let value='', quoted=false
  for(let i=0;i<line.length;i++){
    const char=line[i]
    if(char==='"'&&quoted&&line[i+1]==='"'){value+='"';i++}
    else if(char==='"')quoted=!quoted
    else if(char===','&&!quoted){values.push(value);value=''}
    else value+=char
  }
  values.push(value);return values
}
const lines=(await readFile(join(modelDir,'data/metadata.csv'),'utf8')).trim().split(/\r?\n/)
const header=csvRow(lines.shift())
const rows=lines.map(line=>Object.fromEntries(csvRow(line).map((value,i)=>[header[i],value])))
const required=['age','gender','fitspatrick','region','diameter_1','diameter_2','skin_cancer_history','cancer_history','itch','grew','hurt','changed','bleed','elevation','img_id']
const labelById=new Map([['00000000-0000-4000-8000-000000000001','NEV']])
const patients=new Set()
for(const label of ['NEV','BCC','SCC','ACK','SEK','MEL']){
  let count=0
  for(const row of rows){
    if(row.diagnostic!==label||['PAT_847_1610_165.png','PAT_917_1735_936.png'].includes(row.img_id)||patients.has(row.patient_id)||required.some(key=>!row[key]))continue
    const type=Math.round(Number(row.fitspatrick))
    if(type<1||type>6)continue
    const id=createHash('sha256').update(`skinsafe-history-${row.img_id}`).digest('hex').slice(0,32)
    labelById.set(id,label);patients.add(row.patient_id);count++
    if(count===4)break
  }
  if(count!==4)throw new Error(`Could not map ${label} history records.`)
}
const names={NEV:'Nevus (mole)',BCC:'Basal cell carcinoma',SCC:'Squamous cell carcinoma',ACK:'Actinic keratosis',SEK:'Seborrheic keratosis',MEL:'Melanoma'}
const skinTypes=['I — Always burns, never tans','II — Usually burns, tans a little','III — Sometimes burns, gradually tans','IV — Rarely burns, tans easily','V — Very rarely burns, tans deeply','VI — Never burns, deeply pigmented']
const yn=value=>String(value).toLowerCase()==='true'?'Yes':'No'
function answersFor(row){
  return {age:row.age,region:row.region[0]+row.region.slice(1).toLowerCase(),diameter1:row.diameter_1,diameter2:row.diameter_2,
    itch:yn(row.itch),growth:yn(row.grew),pain:yn(row.hurt),change:yn(row.changed),bleeding:yn(row.bleed),elevation:yn(row.elevation),
    gender:row.gender[0]+row.gender.slice(1).toLowerCase(),skinType:skinTypes[Math.round(Number(row.fitspatrick))-1],
    priorSkinCancer:yn(row.skin_cancer_history),priorCancer:yn(row.cancer_history)}
}
const records=db.prepare('SELECT id,photo,mime,answers,created_at FROM spot_records WHERE user_id=? ORDER BY created_at DESC').all(account.id)
if(records.length!==25||records.some(record=>!labelById.has(record.id)))throw new Error('Expected 25 recognized, sample-only records; nothing was exported.')
await mkdir(images,{recursive:true})
const manifest=[]
for(const record of records){
  const filename=`${record.id}.jpg`
  await writeFile(join(images,filename),record.photo)
  const label=labelById.get(record.id)
  manifest.push({id:record.id,image:`/judge/images/${filename}`,label:names[label],code:label,answers:JSON.parse(record.answers),createdAt:record.created_at})
}
const existingUploads=JSON.parse(await readFile(join(root,'samples/cases.json'),'utf8')).slice(0,2)
const uploads=[]
for(const sample of existingUploads){
  const code=sample.datasetLabel,filename=code==='NEV'?'upload-nevus.jpg':'upload-bcc.jpg'
  const raw=await readFile(join(root,'samples',sample.file))
  await copyFile(join(root,'samples',sample.file),join(output,filename))
  uploads.push({id:`upload-${code}`,image:`/judge/${filename}`,filename,label:names[code],code,answers:sample.answers,sha256:createHash('sha256').update(raw).digest('hex')})
}
const third=rows.find(row=>row.diagnostic==='SCC'&&row.biopsed==='True'&&!patients.has(row.patient_id)&&required.every(key=>row[key])&&Math.round(Number(row.fitspatrick))>=1&&Math.round(Number(row.fitspatrick))<=6)
if(!third)throw new Error('No suitable biopsy-labeled SCC upload image was found.')
const thirdRaw=await readFile(join(modelDir,'data/images',third.img_id))
await writeFile(join(output,'upload-scc.png'),thirdRaw)
uploads.push({id:'upload-SCC',image:'/judge/upload-scc.png',filename:'upload-scc.png',label:names.SCC,code:'SCC',answers:answersFor(third),sha256:createHash('sha256').update(thirdRaw).digest('hex')})
await writeFile(join(output,'records.json'),JSON.stringify(manifest))
await writeFile(join(output,'uploads.json'),JSON.stringify(uploads))
db.close()
console.log(`Exported ${manifest.length} public research-image records for the judge build.`)
