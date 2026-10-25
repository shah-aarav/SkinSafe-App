import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { request } from 'node:http'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test('phone-mode host accepts same-origin login and rejects other hosts', async () => {
  const host = '127.0.0.2'
  const scratch = await mkdtemp(join(tmpdir(), 'skincheck-lan-test-'))
  const probe = createServer()
  await new Promise(resolve => probe.listen(0, host, resolve))
  const port = probe.address().port
  await new Promise(resolve => probe.close(resolve))
  const origin = `http://${host}:${port}`
  const child = spawn(process.execPath, ['server.mjs'], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, PORT: String(port), SKINCHECK_BIND_HOST: host, SKINCHECK_DATA_DIR: scratch },
    stdio: 'ignore',
  })
  try {
    let ready = false
    for (let attempt = 0; attempt < 50; attempt++) {
      try {
        const response = await fetch(`${origin}/api/me`)
        if (response.ok) { ready = true; break }
      } catch {}
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    assert.ok(ready, 'phone-mode server started')
    const page = await fetch(origin)
    assert.equal(page.status, 200)
    const manifest = await fetch(`${origin}/manifest.webmanifest`)
    assert.equal(manifest.status, 200)
    assert.equal((await manifest.json()).display, 'standalone')

    const account = { name: 'Phone QA', email: 'phone@example.test', password: 'a-long-test-password-123' }
    const register = await fetch(`${origin}/api/register`, {
      method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify(account),
    })
    assert.equal(register.status, 201)
    const cookie = register.headers.get('set-cookie')?.split(';')[0]
    assert.ok(cookie)
    const session = await fetch(`${origin}/api/me`, { headers: { Cookie: cookie } })
    assert.equal((await session.json()).user.name, 'Phone QA')

    const wrongOrigin = await fetch(`${origin}/api/logout`, {
      method: 'POST', headers: { Origin: 'http://127.0.0.1:4175', Cookie: cookie },
    })
    assert.equal(wrongOrigin.status, 403)
    const wrongHostStatus = await new Promise((resolve, reject) => {
      const req = request({ hostname: host, port, path: '/api/me', headers: { Host: `127.0.0.1:${port}` } }, res => {
        res.resume()
        res.on('end', () => resolve(res.statusCode))
      })
      req.on('error', reject)
      req.end()
    })
    assert.equal(wrongHostStatus, 403)
  } finally {
    child.kill()
    if (child.exitCode === null) await new Promise(resolve => child.once('exit', resolve))
    await rm(scratch, { recursive: true, force: true })
  }
})
