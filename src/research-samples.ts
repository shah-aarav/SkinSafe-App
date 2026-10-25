import type { Answers } from './storage'

// Only exact, supplied research files receive their recorded questionnaire values.
const samples: Record<string, { answers: Answers; name: string }> = {
  '0117f7f1237cfb9a4a3b430c81cba01a5059e06ceb8cfd34194a2986a0a57af4': {
    name: 'Nevus research image',
    answers: {age:'59',region:'Back',diameter1:'4.0',diameter2:'3.0',itch:'No',growth:'Not sure',pain:'No',change:'Not sure',bleeding:'No',elevation:'No',gender:'Female',skinType:'II — Usually burns, tans a little',priorSkinCancer:'No',priorCancer:'Yes'},
  },
  '9052056c86225c0eb10792070e063351b337314c4f20bc5469e95a4e301ad15e': {
    name: 'BCC research image',
    answers: {age:'60',region:'Back',diameter1:'15.0',diameter2:'10.0',itch:'No',growth:'No',pain:'Yes',change:'No',bleeding:'No',elevation:'No',gender:'Male',skinType:'II — Usually burns, tans a little',priorSkinCancer:'No',priorCancer:'Yes'},
  },
}

export async function detailsForExactResearchFile(file: File) {
  if (!crypto.subtle) return null
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer())), byte => byte.toString(16).padStart(2,'0')).join('')
  return samples[hash] || null
}
