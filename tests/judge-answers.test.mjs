import test from 'node:test'
import assert from 'node:assert/strict'
import { preparedJudgeAnswer } from '../lib/judge-answers.js'

test('each supplied photo has its own condition answer',()=>{
  assert.match(preparedJudgeAnswer('What is this?', 'NEV'),/nevus/i)
  assert.match(preparedJudgeAnswer('What is this?', 'BCC'),/basal cell carcinoma/i)
  assert.match(preparedJudgeAnswer('What is this?', 'SCC'),/squamous cell carcinoma/i)
})

test('medicine answers do not offer OTC cancer treatment',()=>{
  assert.match(preparedJudgeAnswer('What medicine can help?', 'BCC'),/imiquimod.*fluorouracil/i)
  assert.match(preparedJudgeAnswer('What medicine can help?', 'SCC'),/surgical excision.*Mohs/i)
  assert.match(preparedJudgeAnswer('What medicine can help?', 'NEV'),/need no medicine/i)
  assert.match(preparedJudgeAnswer('Can I use an OTC cream?', 'BCC'),/No over-the-counter cream treats BCC/i)
  assert.match(preparedJudgeAnswer('What treatments should I ask about?', 'SCC'),/surgical excision.*Mohs/i)
})

test('appointment preparation is specific and consistent',()=>{
  for(const code of ['NEV','BCC','SCC'])assert.match(preparedJudgeAnswer('What should I bring to my appointment?',code),/photo.*medication list/i)
})

test('unrecognized questions use the generated-answer path',()=>{
  assert.equal(preparedJudgeAnswer('Why do cells divide?', 'BCC'),null)
  assert.equal(preparedJudgeAnswer('What are the side effects of imiquimod?', 'BCC'),null)
  assert.equal(preparedJudgeAnswer('What treatment options exist for advanced melanoma?', 'MEL'),null)
  assert.match(preparedJudgeAnswer('Why might a dermatologist choose Mohs surgery?', 'BCC'),/layer by layer/i)
})

test('follow-up questions answer their specific concern rather than the generic definition',()=>{
  assert.match(preparedJudgeAnswer('What happens if I ignore it?', 'SCC'),/grow deeper.*lymph nodes/i)
  assert.match(preparedJudgeAnswer('How fast should I see a dermatologist?', 'BCC'),/soon rather than waiting months/i)
  assert.match(preparedJudgeAnswer('Can hydrocortisone treat this?', 'BCC'),/^No\. Hydrocortisone does not treat/i)
  assert.match(preparedJudgeAnswer('Can sunscreen cure it?', 'SCC'),/^No\. Sunscreen helps protect/i)
  assert.match(preparedJudgeAnswer('Can I cut this mole off myself?', 'NEV'),/Do not try to remove/i)
})

test('the other saved condition categories have distinct reviewed care answers',()=>{
  assert.match(preparedJudgeAnswer('What is this?', 'ACK'),/rough, sun-damaged/i)
  assert.match(preparedJudgeAnswer('What is this?', 'SEK'),/usually harmless/i)
  assert.match(preparedJudgeAnswer('What is this?', 'MEL'),/serious skin cancer/i)
  assert.match(preparedJudgeAnswer('What treatments should I ask about?', 'ACK'),/tirbanibulin/i)
  assert.match(preparedJudgeAnswer('What treatments should I ask about?', 'MEL'),/surgery/i)
})

test('comparison and monitoring questions do not receive a one-condition definition or invented schedule',()=>{
  for(const code of ['NEV','BCC','SCC','ACK','SEK','MEL']){
    assert.equal(preparedJudgeAnswer('What is the difference between melanoma and a mole?',code),null)
    assert.equal(preparedJudgeAnswer('How is this different from another skin cancer?',code),null)
    assert.match(preparedJudgeAnswer('How often should I photograph this spot?',code),/dermatologist.s advice/i)
  }
  assert.match(preparedJudgeAnswer('Is actinic keratosis cancer?', 'ACK'),/precancerous growth/i)
  assert.match(preparedJudgeAnswer('Is this cancer?', 'SEK'),/benign growth/i)
  assert.match(preparedJudgeAnswer('Is it safe to scrape off this growth?', 'SEK'),/Do not try to remove/i)
  assert.match(preparedJudgeAnswer('What if a mole starts bleeding?', 'NEV'),/dermatologist examination/i)
  assert.match(preparedJudgeAnswer('Does BCC always need Mohs surgery?', 'BCC'),/^No\. Mohs surgery is one treatment option/i)
})
