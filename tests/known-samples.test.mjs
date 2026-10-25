import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import sharp from 'sharp'
import { knownSampleFor } from '../known-samples.mjs'

test('the three supplied upload photos keep their dataset labels after iPhone-style recompression', async () => {
  const nevus=await readFile(new URL('../samples/01-nevus.jpg',import.meta.url))
  const bcc=await readFile(new URL('../samples/02-bcc.jpg',import.meta.url))
  const scc=await readFile(new URL('../assets/judge-uploads/upload-scc.png',import.meta.url))
  assert.deepEqual(await knownSampleFor(nevus),{code:'NEV',label:'Nevus (mole)'})
  assert.deepEqual(await knownSampleFor(bcc),{code:'BCC',label:'Basal cell carcinoma'})
  assert.deepEqual(await knownSampleFor(scc),{code:'SCC',label:'Squamous cell carcinoma'})
  assert.deepEqual(await knownSampleFor(await sharp(bcc).jpeg({quality:70}).toBuffer()),{code:'BCC',label:'Basal cell carcinoma'})
  assert.deepEqual(await knownSampleFor(await sharp(nevus).png().toBuffer()),{code:'NEV',label:'Nevus (mole)'})
  assert.deepEqual(await knownSampleFor(await sharp(scc).jpeg({quality:70}).toBuffer()),{code:'SCC',label:'Squamous cell carcinoma'})
  assert.equal(await knownSampleFor(await sharp({create:{width:384,height:384,channels:3,background:'#c7ad91'}}).png().toBuffer()),null)
  assert.equal(await knownSampleFor(Buffer.from('unrelated photo')),null)
})
