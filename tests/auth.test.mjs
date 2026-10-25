import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test('accounts have independent authenticated records', async () => {
  const scratch = await mkdtemp(join(tmpdir(), 'skincheck-auth-test-'))
  const probe = createServer()
  await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve))
  const port = probe.address().port
  await new Promise(resolve => probe.close(resolve))
  const origin = `http://127.0.0.1:${port}`
  const child = spawn(process.execPath, ['server.mjs'], { cwd: new URL('..', import.meta.url), env: { ...process.env, PORT: String(port), SKINCHECK_DATA_DIR: scratch }, stdio: 'ignore' })
  const call = async (path, method = 'GET', data, cookie, omitOrigin = false) => {
    const response = await fetch(origin + path, { method, headers: { ...(data ? { 'Content-Type': 'application/json' } : {}), ...(method !== 'GET' && !omitOrigin ? { Origin: origin } : {}), ...(cookie ? { Cookie: cookie } : {}) }, body: data ? JSON.stringify(data) : undefined })
    return { response, value: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] }
  }
  try {
    let ready = false
    for (let attempt = 0; attempt < 50; attempt++) {
      try { const result = await call('/api/me'); if (result.response.ok) { ready = true; break } } catch {}
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    assert.ok(ready, 'server started')
    assert.equal((await call('/api/me')).value.user, null)
    assert.equal((await call('/api/dermatologists?zip=60601')).response.status, 401)
    const account = { name: 'Alex', email: 'alex@example.test', password: 'a-long-test-password-123' }
    const first = await call('/api/register', 'POST', account)
    assert.equal(first.response.status, 201)
    assert.match(first.response.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/)
    assert.equal(first.value.user.email, account.email)
    assert.equal((await call('/api/me', 'GET', undefined, first.cookie)).value.user.name, 'Alex')
    assert.equal((await call('/api/dermatologists?zip=abcde', 'GET', undefined, first.cookie)).response.status, 400)
    assert.equal((await call('/api/register', 'POST', account)).response.status, 409)
    assert.equal((await call('/api/logout', 'POST', undefined, first.cookie)).response.status, 200)
    assert.equal((await call('/api/me', 'GET', undefined, first.cookie)).value.user, null)
    assert.equal((await call('/api/login', 'POST', { email: account.email, password: 'incorrect-password' })).response.status, 401)
    const loggedIn = await call('/api/login', 'POST', { email: account.email, password: account.password })
    assert.equal(loggedIn.response.status, 200)
    const photoData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR4kAAAAASUVORK5CYII='
    assert.equal((await call('/api/record', 'PUT', { photoData, answers: { region: 'Arm' }, createdAt: new Date().toISOString() }, loggedIn.cookie)).response.status, 200)
    assert.equal((await call('/api/record', 'GET', undefined, loggedIn.cookie)).value.record.answers.region, 'Arm')
    const firstId = '11111111-1111-4111-8111-111111111111'
    const secondId = '22222222-2222-4222-8222-222222222222'
    for (const [id,region] of [[firstId,'Back'],[secondId,'Chest']]) {
      assert.equal((await call('/api/records', 'PUT', { id, photoData, answers: {region}, createdAt:new Date().toISOString() }, loggedIn.cookie)).response.status, 200)
    }
    assert.equal((await call('/api/records', 'GET', undefined, loggedIn.cookie)).value.records.length, 2)
    assert.match((await call('/api/records', 'GET', undefined, loggedIn.cookie)).value.records[0].photoData, /^data:image\/png;base64,iVBOR/)
    const second = await call('/api/register', 'POST', { name: 'Sam', email: 'sam@example.test', password: 'another-long-password-123' })
    assert.equal(second.response.status, 201)
    assert.equal((await call('/api/record', 'GET', undefined, second.cookie)).value.record, null)
    assert.equal((await call('/api/records', 'GET', undefined, second.cookie)).value.records.length, 0)
    assert.equal((await call(`/api/records/${firstId}`, 'DELETE', undefined, second.cookie)).response.status, 200)
    assert.equal((await call('/api/records', 'GET', undefined, loggedIn.cookie)).value.records.length, 2)
    assert.equal((await call(`/api/records/${firstId}`, 'DELETE', undefined, loggedIn.cookie)).response.status, 200)
    assert.equal((await call('/api/records', 'GET', undefined, loggedIn.cookie)).value.records.length, 1)
    assert.equal((await call('/api/record', 'PUT', { photoData, answers: {}, createdAt: new Date().toISOString() }, second.cookie, true)).response.status, 403)
    assert.equal((await call('/api/record', 'DELETE', undefined, loggedIn.cookie)).response.status, 200)
    assert.equal((await call('/api/record', 'GET', undefined, loggedIn.cookie)).value.record, null)
  } finally {
    child.kill()
    if (child.exitCode === null) await new Promise(resolve => child.once('exit', resolve))
    await rm(scratch, { recursive: true, force: true })
  }
})
