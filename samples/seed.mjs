import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createHash } from 'node:crypto'

const origin = process.env.SKINCHECK_ORIGIN || 'http://127.0.0.1:4175'
const email = process.env.SKINCHECK_SAMPLE_EMAIL
const password = process.env.SKINCHECK_SAMPLE_PASSWORD
if (!email || !password) throw new Error('Set SKINCHECK_SAMPLE_EMAIL and SKINCHECK_SAMPLE_PASSWORD first.')

const signIn = await fetch(`${origin}/api/login`, {
  method: 'POST',
  headers: { Origin: origin, 'Content-Type': 'application/json' },
  body: JSON.stringify({email,password})
})
if (!signIn.ok) throw new Error(`Login failed (${signIn.status}).`)
const cookie = signIn.headers.get('set-cookie')?.split(';')[0]
if (!cookie) throw new Error('No session cookie was returned.')

const cases = JSON.parse(await readFile(new URL('cases.json', import.meta.url), 'utf8'))
const listRecords = async () => {
  const response = await fetch(`${origin}/api/records`, {headers:{Cookie:cookie}})
  if (!response.ok) throw new Error(`Could not read saved records (${response.status}).`)
  return (await response.json()).records
}
const existing = await listRecords()
const idFor = file => createHash('sha256').update(`${email}:${file}`).digest('hex').slice(0,32)
const latestId = idFor('01-nevus.jpg')
if (existing.length && existing[0].id !== latestId) throw new Error('The latest saved record is not the prepared nevus image; no records were changed.')
const latest = existing.find(record=>record.id===latestId)
const samplesToAdd = latest ? [] : cases.filter(item=>item.file==='01-nevus.jpg')
const history = cases.filter(item=>item.file==='history-nevus.jpg' || /^history-\d{2}\.png$/.test(item.file))
for (const [index, sample] of [...samplesToAdd,...history].entries()) {
  const id = idFor(sample.file)
  if (existing.some(record=>record.id===id)) continue
  const image = await readFile(join(import.meta.dirname, sample.file))
  const baseDate = latest?.createdAt || new Date(Date.now() - 2*86400000).toISOString()
  const ageInWeeks = sample.file==='01-nevus.jpg' ? 0 : (index - samplesToAdd.length + 1)
  const mime = sample.file.endsWith('.png') ? 'image/png' : 'image/jpeg'
  const response = await fetch(`${origin}/api/records`, {
    method: 'PUT',
    headers: { Origin: origin, Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id,
      photoData: `data:${mime};base64,${image.toString('base64')}`,
      answers: sample.answers,
      createdAt: new Date(Date.parse(baseDate) - ageInWeeks*7*86400000).toISOString()
    })
  })
  if (!response.ok) throw new Error(`Could not seed ${sample.file} (${response.status}).`)
}
const records = await listRecords()
if (records[0]?.id !== latestId) throw new Error('The prepared nevus is no longer the latest record.')
console.log(`Account ready with ${records.length} saved records.`)
for (const sample of cases.filter(item=>['01-nevus.jpg','02-bcc.jpg'].includes(item.file))) {
  const image = await readFile(join(import.meta.dirname, sample.file))
  const check = await fetch(`${origin}/api/assess`, {
    method: 'POST',
    headers: { Origin: origin, Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({photoData:`data:image/jpeg;base64,${image.toString('base64')}`,answers:sample.answers})
  })
  if (!check.ok) throw new Error(`Assessment failed for ${sample.file} (${check.status}).`)
  const result = await check.json()
  if (result.flagged !== sample.expectedFlag) throw new Error(`${sample.file} no longer matches its recorded result.`)
  console.log(`${sample.file}: ${result.flagged ? 'review flag' : 'no flag'}`)
}
