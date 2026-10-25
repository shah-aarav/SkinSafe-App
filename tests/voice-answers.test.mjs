import test from 'node:test'
import assert from 'node:assert/strict'
import { answerQuestion, preparedTypedQuestion } from '../src/voice-answers.ts'

test('the two recording cases receive distinct result and next-step answers', () => {
  const flagged=answerQuestion('What does this result mean?',true,false)
  const clear=answerQuestion('Does no flag mean this is safe?',false,false)
  assert.match(flagged,/cancer-review flag/)
  assert.match(flagged,/cannot say what the spot is/)
  assert.match(clear,/does not tell us what the spot is/)
  assert.match(clear,/rule out cancer/)
  assert.match(answerQuestion('What should I do next?',true,false),/examination soon/)
  assert.match(answerQuestion('What should I do next?',false,false),/baseline/)
})

test('medical treatment questions do not suggest home remedies', () => {
  assert.match(answerQuestion('Can I remove it with cream at home?',true,false),/Do not try to remove/)
  assert.match(answerQuestion('Where can I find a clinic near me?',true,false),/ZIP code/)
  assert.match(answerQuestion('Is this BCC?',true,false),/cannot say what the spot is/)
  assert.match(answerQuestion('Is this a nevus?',false,false),/does not tell us what the spot is/)
  assert.match(answerQuestion('What is BCC?',true,false),/type of skin cancer/)
  assert.match(answerQuestion('What is a nevus?',false,false),/medical name for a mole/)
  assert.match(answerQuestion('Is this BCC?',true,false,'BCC'),/label comes from the dataset/)
  assert.match(answerQuestion('What is it?',false,false,'NEV'),/labeled nevus/)
  assert.match(answerQuestion('Can you answer my headache question?',true,false),/cannot diagnose/)
})

test('the prepared typed appointment question has its own BCC answer', () => {
  const answer=answerQuestion(preparedTypedQuestion,true,false,'BCC')
  assert.match(answer,/Bring this photo and your notes/)
  assert.match(answer,/decide whether a biopsy is needed/)
  assert.doesNotMatch(answer,/ZIP code/)
  assert.match(answerQuestion(preparedTypedQuestion,true,false),/Bring this photo and your notes/)
  assert.match(answerQuestion('What do I need to bring to my dermatologist appointment?',true,false),/Bring this photo and your notes/)
})

test('the saved nevus case has a prepared typed answer', () => {
  const answer=answerQuestion('What should I watch for in this mole?',false,false,'NEV')
  assert.match(answer,/changes size, shape, or color/)
  assert.match(answer,/Keep this photo for comparison/)
})

test('OTC answers describe prevention without clearing or treating a spot', () => {
  const routine=answerQuestion('Any OTC options?',false,false)
  const review=answerQuestion('Any OTC options?',true,false)
  assert.match(routine,/1 percent hydrocortisone cream/)
  assert.match(routine,/Do not use it to treat the photographed spot/)
  assert.match(review,/dermatologist exam/)
  assert.match(review,/Do not put hydrocortisone/)
})
