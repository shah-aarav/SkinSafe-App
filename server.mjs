import { createServer } from 'node:http'
import { DatabaseSync } from 'node:sqlite'
import { randomBytes, createHash, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { readFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve, join, extname, sep } from 'node:path'
import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'
import { findDermatologyOffices } from './clinic-search.mjs'
import { knownSampleFor } from './known-samples.mjs'
import { answerMedicalQuestion } from './medical-answer.mjs'

const scrypt = promisify(scryptCallback)
const root = resolve(import.meta.dirname)
const dist = join(root, 'dist')
const dataDir = process.env.SKINCHECK_DATA_DIR ? resolve(process.env.SKINCHECK_DATA_DIR) : join(root, '.data')
await mkdir(dataDir, { recursive: true })
const db = new DatabaseSync(join(dataDir, 'skincheck.sqlite'))
db.exec(`PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, salt TEXT NOT NULL, password_hash TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS records (user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, photo BLOB NOT NULL, mime TEXT NOT NULL, answers TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS spot_records (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, photo BLOB NOT NULL, mime TEXT NOT NULL, answers TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS spot_records_user_date ON spot_records(user_id, created_at DESC);`)
if (db.prepare('PRAGMA user_version').get().user_version === 0) {
  db.exec("INSERT OR IGNORE INTO spot_records (id,user_id,photo,mime,answers,created_at) SELECT 'legacy-' || user_id,user_id,photo,mime,answers,created_at FROM records")
  db.exec('PRAGMA user_version=1')
}
const q = {
  userByEmail: db.prepare('SELECT * FROM users WHERE email=?'),
  userBySession: db.prepare('SELECT users.id, users.name, users.email FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token_hash=? AND sessions.expires_at>?'),
  createUser: db.prepare('INSERT INTO users (id,name,email,salt,password_hash,created_at) VALUES (?,?,?,?,?,?)'),
  createSession: db.prepare('INSERT INTO sessions (token_hash,user_id,expires_at) VALUES (?,?,?)'),
  deleteSession: db.prepare('DELETE FROM sessions WHERE token_hash=?'),
  getRecord: db.prepare('SELECT photo,mime,answers,created_at FROM records WHERE user_id=?'),
  putRecord: db.prepare('INSERT INTO records (user_id,photo,mime,answers,created_at) VALUES (?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET photo=excluded.photo,mime=excluded.mime,answers=excluded.answers,created_at=excluded.created_at'),
  deleteRecord: db.prepare('DELETE FROM records WHERE user_id=?'),
  listSpotRecords: db.prepare('SELECT id,photo,mime,answers,created_at FROM spot_records WHERE user_id=? ORDER BY created_at DESC'),
  putSpotRecord: db.prepare('INSERT INTO spot_records (id,user_id,photo,mime,answers,created_at) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET photo=excluded.photo,mime=excluded.mime,answers=excluded.answers,created_at=excluded.created_at WHERE user_id=excluded.user_id'),
  deleteSpotRecord: db.prepare('DELETE FROM spot_records WHERE id=? AND user_id=?')
}
const failed = new Map()
const hashToken = token => createHash('sha256').update(token).digest('hex')
const cookieName = 'skincheck_session'
const days = 7 * 24 * 60 * 60 * 1000
const mimeTypes = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.mp3':'audio/mpeg','.webmanifest':'application/manifest+json','.woff':'font/woff','.woff2':'font/woff2'}
const modelDir = resolve(root, '../skincheck-model')
const python = process.platform === 'win32' ? join(modelDir,'.venv','Scripts','python.exe') : join(modelDir,'.venv','bin','python')
const worker = spawn(python, [join(root,'inference','predict.py')], {cwd:modelDir,stdio:['pipe','pipe','pipe'],windowsHide:true})
let modelReady = false
let modelFailed = false
let modelSequence = 0
const pendingAssessments = new Map()
createInterface({input:worker.stdout}).on('line', line => {
  let message
  try { message = JSON.parse(line) } catch { return }
  if (message.ready) { modelReady = true; console.log('SkinSafe model ready'); return }
  const pending = pendingAssessments.get(message.id)
  if (!pending) return
  clearTimeout(pending.timeout)
  pendingAssessments.delete(message.id)
  if (message.error) pending.reject(new Error(message.error))
  else pending.resolve(message.result)
})
worker.stderr.on('data', chunk => console.error(String(chunk).trim()))
worker.on('error', error => { modelFailed = true; console.error('Model worker could not start:',error.message) })
worker.on('exit', code => {
  modelReady = false
  modelFailed = true
  for (const pending of pendingAssessments.values()) { clearTimeout(pending.timeout); pending.reject(new Error('Assessment unavailable.')) }
  pendingAssessments.clear()
  console.error(`Model worker stopped (${code}).`)
})
process.on('SIGINT', () => { worker.kill(); process.exit(0) })
process.on('SIGTERM', () => { worker.kill(); process.exit(0) })
function assess(input) {
  if (modelFailed) throw Object.assign(new Error('Assessment unavailable on this server.'),{status:503})
  if (!modelReady) throw Object.assign(new Error('Assessment is loading. Try again in a moment.'),{status:503})
  return new Promise((resolve,reject) => {
    const id = ++modelSequence
    const timeout = setTimeout(() => { pendingAssessments.delete(id); reject(Object.assign(new Error('Assessment timed out. Please try again.'),{status:504})) },90000)
    pendingAssessments.set(id,{resolve,reject,timeout})
    worker.stdin.write(JSON.stringify({...input,id})+'\n',error => {
      if (error && pendingAssessments.has(id)) { clearTimeout(timeout); pendingAssessments.delete(id); reject(Object.assign(new Error('Assessment unavailable.'),{status:503})) }
    })
  })
}

function send(res, status, value, extra = {}) {
  res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...extra})
  res.end(JSON.stringify(value))
}
function cookie(req) {
  const found = (req.headers.cookie || '').split(';').map(value => value.trim()).find(value => value.startsWith(`${cookieName}=`))
  const token = found?.slice(cookieName.length + 1)
  return token && /^[a-f0-9]{64}$/.test(token) ? token : null
}
function sessionUser(req) {
  const token = cookie(req)
  return token ? q.userBySession.get(hashToken(token), Date.now()) : undefined
}
function setSession(req, res, userId) {
  const previous = cookie(req)
  if (previous) q.deleteSession.run(hashToken(previous))
  const token = randomBytes(32).toString('hex')
  q.createSession.run(hashToken(token), userId, Date.now() + days)
  res.setHeader('Set-Cookie', `${cookieName}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${days / 1000}`)
}
function clearSession(req, res) {
  const token = cookie(req)
  if (token) q.deleteSession.run(hashToken(token))
  res.setHeader('Set-Cookie', `${cookieName}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`)
}
async function body(req, maxBytes = 8192) {
  let length = 0
  const chunks = []
  for await (const chunk of req) {
    length += chunk.length
    if (length > maxBytes) { const error = new Error('Request too large.'); error.status = 413; throw error }
    chunks.push(chunk)
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { const error = new Error('Invalid request.'); error.status = 400; throw error }
}
function publicUser(user) { return {id:user.id,name:user.name,email:user.email} }
function validEmail(email) { return typeof email === 'string' && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) }
async function passwordHash(password, salt) { return await scrypt(password, Buffer.from(salt, 'hex'), 64, {N:32768,r:8,p:3,maxmem:64*1024*1024}) }
function limitKey(req, email) { return `${req.socket.remoteAddress}:${email}` }
function limited(key) {
  const state = failed.get(key)
  return state && state.until > Date.now() && state.count >= 5
}
function fail(key) {
  const state = failed.get(key)
  const next = state && state.until > Date.now() ? {count:state.count+1,until:state.until} : {count:1,until:Date.now()+15*60*1000}
  failed.set(key,next)
}
async function api(req, res, path) {
  if (!['GET','POST','PUT','DELETE'].includes(req.method)) return send(res,405,{error:'Method not allowed.'})
  if (req.method !== 'GET') {
    const expected = `http://${req.headers.host}`
    if (req.headers.origin !== expected) return send(res,403,{error:'Request origin was not accepted.'})
    if (!req.headers['content-type']?.startsWith('application/json') && path !== '/api/logout' && !(req.method === 'DELETE' && (path === '/api/record' || path.startsWith('/api/records/')))) return send(res,415,{error:'JSON required.'})
  }
  if (path === '/api/me' && req.method === 'GET') return send(res,200,{user:sessionUser(req) || null})
  if (path === '/api/register' && req.method === 'POST') {
    const input = await body(req)
    const name = typeof input.name === 'string' ? input.name.trim() : ''
    const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : ''
    const password = input.password
    if (name.length < 1 || name.length > 60 || !validEmail(email) || typeof password !== 'string' || password.length < 12 || password.length > 128) return send(res,400,{error:'Enter a name, valid email, and password of 12–128 characters.'})
    if (q.userByEmail.get(email)) return send(res,409,{error:'An account with this email already exists. Log in instead.'})
    const salt = randomBytes(16).toString('hex')
    const hash = (await passwordHash(password,salt)).toString('hex')
    const user = {id:randomBytes(16).toString('hex'),name,email}
    q.createUser.run(user.id,name,email,salt,hash,new Date().toISOString())
    setSession(req,res,user.id)
    return send(res,201,{user})
  }
  if (path === '/api/login' && req.method === 'POST') {
    const input = await body(req)
    const entered = typeof input.email === 'string' ? input.email.trim().toLowerCase() : ''
    const email = entered === 'skinsafeapp' ? 'skinsafeapp@local.test' : entered
    const password = input.password
    if (!validEmail(email) || typeof password !== 'string' || password.length > 128) return send(res,401,{error:'Email or password is incorrect.'})
    const key = limitKey(req,email)
    if (limited(key)) return send(res,429,{error:'Too many attempts. Try again in 15 minutes.'})
    const user = q.userByEmail.get(email)
    const salt = user?.salt || '0'.repeat(32)
    const expected = user ? Buffer.from(user.password_hash,'hex') : Buffer.alloc(64)
    const actual = await passwordHash(password,salt)
    if (!user || !timingSafeEqual(expected,actual)) { fail(key); return send(res,401,{error:'Email or password is incorrect.'}) }
    failed.delete(key)
    setSession(req,res,user.id)
    return send(res,200,{user:publicUser(user)})
  }
  if (path === '/api/logout' && req.method === 'POST') { clearSession(req,res); return send(res,200,{ok:true}) }
  const user = sessionUser(req)
  if (!user) return send(res,401,{error:'Please log in again.'})
  if (path === '/api/ask' && req.method === 'POST') {
    const input = await body(req, 2048)
    const question = typeof input.question === 'string' ? input.question.trim() : ''
    const result = input.result
    if (!question || question.length > 240 || !result || typeof result.flagged !== 'boolean' || typeof result.warningSigns !== 'boolean') return send(res,400,{error:'Enter a question about your result.'})
    try { return send(res,200,{answer:await answerMedicalQuestion(question,result)}) }
    catch (error) { return send(res,error.status || 502,{error:error.message}) }
  }
  if (path === '/api/dermatologists' && req.method === 'GET') {
    const zip = new URL(req.url, `http://${req.headers.host}`).searchParams.get('zip') || ''
    try { return send(res,200,await findDermatologyOffices(zip)) }
    catch (error) { return send(res,error.status || 502,{error:error.message === 'Enter a five-digit U.S. ZIP code.' ? error.message : 'The provider directory is unavailable. Try again later.'}) }
  }
  if (path === '/api/assess' && req.method === 'POST') {
    const input = await body(req,29*1024*1024)
    const match = typeof input.photoData === 'string' && /^data:image\/(?:jpeg|png|webp|heic|heif);base64,([A-Za-z0-9+/=]+)$/.exec(input.photoData)
    const photo = match ? Buffer.from(match[1],'base64') : null
    if (!photo || photo.length < 1 || photo.length > 20*1024*1024 || !input.answers || typeof input.answers !== 'object' || Array.isArray(input.answers) || Object.keys(input.answers).length > 30 || Object.values(input.answers).some(value=>typeof value !== 'string' || value.length > 300)) return send(res,400,{error:'Please provide a photo and the spot details.'})
    try { const result=await assess(input); return send(res,200,{...result,referenceImage:await knownSampleFor(photo)}) }
    catch (error) { return send(res,error.status || 422,{error:error.message}) }
  }
  if (path === '/api/records' && req.method === 'GET') {
    const records = q.listSpotRecords.all(user.id).map(record => ({id:record.id,photoData:`data:${record.mime};base64,${Buffer.from(record.photo).toString('base64')}`,answers:JSON.parse(record.answers),createdAt:record.created_at}))
    return send(res,200,{records})
  }
  if (path === '/api/records' && req.method === 'PUT') {
    const input = await body(req, 29*1024*1024)
    const match = typeof input.photoData === 'string' && /^data:(image\/(?:jpeg|png|webp|heic|heif));base64,([A-Za-z0-9+/=]+)$/.exec(input.photoData)
    const photo = match ? Buffer.from(match[2],'base64') : null
    const answers = input.answers
    const id = typeof input.id === 'string' && /^[a-f0-9-]{8,64}$/.test(input.id) ? input.id : null
    if (!id || !photo || photo.length < 1 || photo.length > 20*1024*1024 || !answers || typeof answers !== 'object' || Array.isArray(answers) || Object.keys(answers).length > 30 || Object.values(answers).some(value=>typeof value !== 'string' || value.length > 300) || !Number.isFinite(Date.parse(input.createdAt))) return send(res,400,{error:'This record could not be saved. Check the photo and try again.'})
    q.putSpotRecord.run(id,user.id,photo,match[1],JSON.stringify(answers),input.createdAt)
    return send(res,200,{ok:true})
  }
  if (path.startsWith('/api/records/') && req.method === 'DELETE') {
    const id = path.slice('/api/records/'.length)
    if (!/^[a-f0-9-]{8,64}$/.test(id)) return send(res,400,{error:'Invalid record.'})
    q.deleteSpotRecord.run(id,user.id)
    return send(res,200,{ok:true})
  }
  if (path === '/api/record') {
    if (req.method === 'GET') {
      const record = q.getRecord.get(user.id)
      return send(res,200,{record:record?{photoData:`data:${record.mime};base64,${Buffer.from(record.photo).toString('base64')}`,answers:JSON.parse(record.answers),createdAt:record.created_at}:null})
    }
    if (req.method === 'PUT') {
      const input = await body(req, 29*1024*1024)
      const match = typeof input.photoData === 'string' && /^data:(image\/(?:jpeg|png|webp|heic|heif));base64,([A-Za-z0-9+/=]+)$/.exec(input.photoData)
      const photo = match ? Buffer.from(match[2],'base64') : null
      const answers = input.answers
      if (!photo || photo.length < 1 || photo.length > 20*1024*1024 || !answers || typeof answers !== 'object' || Array.isArray(answers) || Object.keys(answers).length > 30 || Object.values(answers).some(value=>typeof value !== 'string' || value.length > 300) || !Number.isFinite(Date.parse(input.createdAt))) return send(res,400,{error:'This record could not be saved. Check the photo and try again.'})
      q.putRecord.run(user.id,photo,match[1],JSON.stringify(answers),input.createdAt)
      return send(res,200,{ok:true})
    }
    if (req.method === 'DELETE') { q.deleteRecord.run(user.id); return send(res,200,{ok:true}) }
  }
  return send(res,404,{error:'Not found.'})
}
async function staticFile(req,res,path) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res,405,{error:'Method not allowed.'})
  const file = path === '/' ? join(dist,'index.html') : resolve(dist,`.${path}`)
  if (!(file === join(dist,'index.html') || file.startsWith(dist+sep)) || !existsSync(file)) return send(res,404,{error:'Not found.'})
  const content = await readFile(file)
  res.writeHead(200,{'Content-Type':mimeTypes[extname(file)] || 'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':extname(file)==='.html'?'no-store':'public, max-age=3600','Content-Security-Policy':"default-src 'self'; img-src 'self' blob: data:; style-src 'self' 'unsafe-inline'; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"})
  res.end(req.method === 'HEAD' ? undefined : content)
}
const port = Number(process.env.PORT || 4175)
const bindHost = process.env.SKINCHECK_BIND_HOST || '127.0.0.1'
createServer(async (req,res)=>{
  try {
    if (req.headers.host !== `${bindHost}:${port}`) return send(res,403,{error:'Host not accepted.'})
    const path = new URL(req.url,`http://${req.headers.host}`).pathname
    if (path.startsWith('/api/')) await api(req,res,path)
    else await staticFile(req,res,path)
  } catch (error) {
    if (error.status) return send(res,error.status,{error:error.message})
    console.error(error)
    send(res,500,{error:'Something went wrong. Please try again.'})
  }
}).listen(port,bindHost,()=>console.log(`SkinSafe running at http://${bindHost}:${port}/`))
