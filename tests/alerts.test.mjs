import test from 'node:test'
import assert from 'node:assert/strict'
import { POST as visit } from '../api/visit.js'
import { sendAlert } from '../lib/alerts.js'

test('visit alerts reject cross-origin requests and avoid repeated mail', async () => {
  const blocked = await visit(new Request('https://skinsafe.test/api/visit', {
    method: 'POST', headers: { origin: 'https://another.test' },
  }))
  assert.equal(blocked.status, 403)
  const repeated = await visit(new Request('https://skinsafe.test/api/visit', {
    method: 'POST', headers: { origin: 'https://skinsafe.test', cookie: 'sc_visit_alerted=1' },
  }))
  assert.equal(repeated.status, 204)
  assert.match(repeated.headers.get('set-cookie'), /Max-Age=86400/)
})

test('alerts send only the event and timestamp, without page activity', async () => {
  const oldKey = process.env.AGENTMAIL_API_KEY
  const oldEmail = process.env.SKINSAFE_ALERT_EMAIL
  const oldFetch = globalThis.fetch
  const calls = []
  try {
    process.env.AGENTMAIL_API_KEY = 'test-key'
    process.env.SKINSAFE_ALERT_EMAIL = 'owner@example.com\n'
    globalThis.fetch = async (url, options) => {
      calls.push({ url, body: JSON.parse(options.body) })
      return Response.json(calls.length === 1 ? { inbox_id: 'inbox@agentmail.to' } : { message_id: 'sent' })
    }
    assert.equal(await sendAlert('SkinSafe website opened'), true)
    assert.equal(calls.length, 2)
    assert.deepEqual(calls[1].body.to, ['owner@example.com'])
    assert.equal(calls[1].body.subject, 'SkinSafe website opened')
    assert.match(calls[1].body.text, /^SkinSafe website opened\n\d{4}-/)
  } finally {
    if (oldKey === undefined) delete process.env.AGENTMAIL_API_KEY
    else process.env.AGENTMAIL_API_KEY = oldKey
    if (oldEmail === undefined) delete process.env.SKINSAFE_ALERT_EMAIL
    else process.env.SKINSAFE_ALERT_EMAIL = oldEmail
    globalThis.fetch = oldFetch
  }
})
