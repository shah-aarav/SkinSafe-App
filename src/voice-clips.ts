export function voiceClipForAnswer(answer:string):string {
  let hash=2166136261
  for(let i=0;i<answer.length;i++) {
    hash^=answer.charCodeAt(i)
    hash=Math.imul(hash,16777619)
  }
  return `answer-${(hash>>>0).toString(16).padStart(8,'0')}.mp3`
}
