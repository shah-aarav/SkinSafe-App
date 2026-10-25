import test from 'node:test'
import assert from 'node:assert/strict'
import { answerMedicalQuestion } from '../medical-answer.mjs'

test('a missing key does not pretend to generate an answer', async () => {
  await assert.rejects(answerMedicalQuestion('What should I bring?', { flagged: true, warningSigns: false }, { apiKey: '' }), /not connected/)
})

test('a typed question is sent without the photo and returns generated text', async () => {
  let request
  const fetcher = async (_url, options) => {
    request = options
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Bring your photo timeline and notes.' }] } }] }) }
  }
  const answer = await answerMedicalQuestion('What should I bring?', { flagged: true, warningSigns: false }, { apiKey: 'test-key', fetcher })
  assert.equal(answer, 'Bring your photo timeline and notes.')
  assert.equal(request.headers['x-goog-api-key'], 'test-key')
  assert.match(request.body, /What should I bring\?/)
  assert.doesNotMatch(request.body, /photoData/)
})
