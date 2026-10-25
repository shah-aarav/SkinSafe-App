import { spawnSync } from 'node:child_process'
import { copyFile, mkdir, rename, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { answerQuestion, preparedTypedQuestion } from '../src/voice-answers.ts'
import { voiceClipForAnswer } from '../src/voice-clips.ts'

const root = join(import.meta.dirname, '..')
const cli = join(root, '.voice-tools', 'Scripts', 'edge-tts.exe')
const output = join(root, 'public', 'voice')
const voice = 'en-US-AvaNeural'
const rate = '-4%'
const rendered = new Map()
await mkdir(output, {recursive:true})

async function render(answer,destination) {
  if ((await stat(destination).catch(()=>({size:0}))).size>1000) return
  const temporary = `${destination}.new`
  for (let attempt=1;attempt<=3;attempt++) {
    await rm(temporary,{force:true})
    const run = spawnSync(cli,['--voice',voice,`--rate=${rate}`,'--text',answer,'--write-media',temporary],{encoding:'utf8'})
    if (run.status===0 && (await stat(temporary).catch(()=>({size:0}))).size>1000) {
      await rename(temporary,destination)
      console.log(destination)
      return
    }
    if (attempt===3) throw new Error(`Could not render ${destination}: ${run.stderr || run.stdout}`)
    await delay(700*attempt)
  }
}

const groups = [
  {code:'nev', flagged:false, referenceCode:'NEV', prompts:[
    'Does no flag mean this is safe?',
    'What should I do next?',
    'What is a nevus?',
    'What changes should I watch for?',
  ]},
  {code:'bcc', flagged:true, referenceCode:'BCC', prompts:[
    'What does this result mean?',
    'What should I do next?',
    'Is this BCC?',
    'Where can I find a dermatologist?',
  ]},
]
for (const group of groups) {
  for (const [index,prompt] of group.prompts.entries()) {
    const answer = answerQuestion(prompt,group.flagged,false,group.referenceCode)
    const destination = join(output,`${group.code}-${index+1}.mp3`)
    await render(answer,destination)
    rendered.set(answer,destination)
  }
}
const typedAnswer = answerQuestion(preparedTypedQuestion,true,false,'BCC')
const typedDestination = join(output,'bcc-typed.mp3')
await render(typedAnswer,typedDestination)
rendered.set(typedAnswer,typedDestination)

const questions = [
  'What should I watch for in this mole?', 'What should I bring to my appointment?',
  'Is this an emergency?', 'Are there any OTC medicines?', 'Can I treat this at home?',
  'Would I need a biopsy?', 'Where can I find a dermatologist?',
  'How accurate is the result?', 'What changes should I watch for?',
  'What should I do next?', 'What is BCC?', 'What is a nevus?',
  'Is this BCC?', 'Is this a nevus?', 'What is it?',
  'What does this result mean?', 'Can you answer my unrelated question?'
]
const contexts = [undefined,'NEV','BCC'].flatMap(referenceCode=>[
  {flagged:false,warningSigns:false,referenceCode},
  {flagged:true,warningSigns:false,referenceCode},
  {flagged:false,warningSigns:true,referenceCode}
])
const answers = new Set(contexts.flatMap(context=>questions.map(question=>answerQuestion(question,context.flagged,context.warningSigns,context.referenceCode))))
for(const answer of answers) {
  const destination=join(output,voiceClipForAnswer(answer))
  const existing=rendered.get(answer)
  if(existing) await copyFile(existing,destination)
  else await render(answer,destination)
}
