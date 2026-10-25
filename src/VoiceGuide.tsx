import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { askAboutResult } from './api'
import { answerQuestion } from './voice-answers'

function speechChunks(value:string){
  const words=value.replace(/\bBCC\b/g,'B C C').replace(/\bSCC\b/g,'S C C').replace(/\bOTC\b/g,'over-the-counter').replace(/\b5-FU\b/g,'five F U').split(/\s+/)
  const chunks:string[]=[]
  let current=''
  for(const word of words){
    if(current&&`${current} ${word}`.length>180){chunks.push(current);current=word}
    else current=current?`${current} ${word}`:word
  }
  if(current)chunks.push(current)
  return chunks
}

export default function VoiceGuide({flagged,warningSigns,referenceCode}:{flagged:boolean;warningSigns:boolean;referenceCode?:string}) {
  const prompts = referenceCode==='BCC'
    ? ['What does this result mean?', 'What should I bring to my appointment?', 'What treatments should I ask about?']
    : referenceCode==='SCC'
      ? ['What is squamous cell carcinoma?', 'What should I bring to my appointment?', 'What treatments should I ask about?']
    : referenceCode==='NEV'
      ? ['What is a nevus?', 'What changes should I watch for?', 'Does this mole need medicine?']
    : referenceCode==='ACK'
      ? ['What is actinic keratosis?', 'What treatments should I ask about?', 'What changes should I watch for?']
    : referenceCode==='SEK'
      ? ['What is seborrheic keratosis?', 'Does it need medicine?', 'When should I see a dermatologist?']
    : referenceCode==='MEL'
      ? ['What is melanoma?', 'What should I do next?', 'What treatments should I ask about?']
      : ['What does this result mean?', 'What changes should I watch for?', 'What should I bring to my appointment?']
  const [question,setQuestion]=useState('')
  const [asked,setAsked]=useState('')
  const [answer,setAnswer]=useState('')
  const [loading,setLoading]=useState(false)
  const [speaking,setSpeaking]=useState(false)
  const [preparingVoice,setPreparingVoice]=useState(false)
  const [voiceError,setVoiceError]=useState('')
  const [error,setError]=useState('')
  const requestId=useRef(0)
  const playbackId=useRef(0)
  const audio=useRef<HTMLAudioElement|null>(null)
  const speechRequest=useRef<AbortController|null>(null)
  const clips=useRef(new Map<string,string[]>())
  useEffect(()=>()=>{
    requestId.current++;playbackId.current++
    speechRequest.current?.abort()
    audio.current?.pause()
    for(const urls of clips.current.values())for(const url of urls)URL.revokeObjectURL(url)
    clips.current.clear()
  },[])
  function stopSpeaking(){
    playbackId.current++
    speechRequest.current?.abort();speechRequest.current=null
    audio.current?.pause();audio.current=null
    setSpeaking(false);setPreparingVoice(false)
  }
  async function naturalClips(value:string,signal:AbortSignal){
    const cached=clips.current.get(value)
    if(cached)return cached
    const urls:string[]=[]
    try{
      for(const text of speechChunks(value)){
        const response=await fetch('/api/speak',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({text}),signal})
        if(!response.ok)throw new Error('Speech unavailable')
        urls.push(URL.createObjectURL(await response.blob()))
      }
      clips.current.set(value,urls)
      return urls
    }catch(cause){for(const url of urls)URL.revokeObjectURL(url);throw cause}
  }
  function playClips(urls:string[],id:number,index=0){
    if(playbackId.current!==id)return
    if(index>=urls.length){audio.current=null;setSpeaking(false);return}
    const player=new Audio(urls[index])
    audio.current=player
    player.onended=()=>playClips(urls,id,index+1)
    player.onerror=()=>{if(playbackId.current===id)setSpeaking(false)}
    void player.play().then(()=>{if(playbackId.current===id)setSpeaking(true)}).catch(()=>{
      if(playbackId.current===id){setSpeaking(false);setVoiceError('Tap Hear answer to play the voice.')}
    })
  }
  function speak(value:string){
    stopSpeaking()
    const id=playbackId.current
    setVoiceError('')
    const cached=clips.current.get(value)
    if(cached){playClips(cached,id);return}
    const controller=new AbortController()
    speechRequest.current=controller
    setPreparingVoice(true)
    void naturalClips(value,controller.signal).then(urls=>{
      if(playbackId.current!==id)return
      speechRequest.current=null;setPreparingVoice(false);playClips(urls,id)
    }).catch(()=>{
      if(playbackId.current===id){speechRequest.current=null;setPreparingVoice(false);setVoiceError('Voice is busy. Try again shortly.')}
    })
  }
  async function ask(value:string){
    const trimmed=value.trim()
    if(!trimmed)return
    const id=++requestId.current
    stopSpeaking();setLoading(true);setError('');setAnswer('');setAsked(trimmed);setQuestion(trimmed)
    try{
      const response=await askAboutResult(trimmed,{flagged,warningSigns},referenceCode)
      if(id!==requestId.current)return
      setAnswer(response);speak(response)
    }catch(cause){
      if(id!==requestId.current)return
      if(cause instanceof Error&&['Answers are not connected yet.','Not found.'].includes(cause.message)&&prompts.includes(trimmed)){
        const prepared=answerQuestion(trimmed,flagged,warningSigns,referenceCode==='NEV'||referenceCode==='BCC'?referenceCode:undefined)
        setAnswer(prepared);speak(prepared)
      }else setError(cause instanceof Error?cause.message:'Could not answer right now. Try again.')
    }
    finally{if(id===requestId.current)setLoading(false)}
  }
  function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();void ask(question)}
  return <section className="voice-guide" aria-labelledby="voice-title"><h2 id="voice-title">Ask about your result</h2><div className="suggested-questions" aria-label="Suggested questions">{prompts.map(prompt=><button key={prompt} type="button" disabled={loading} onClick={()=>void ask(prompt)}>{prompt}</button>)}</div><form onSubmit={submit}><label htmlFor="voice-question">Your question</label><div className="voice-input-row"><input id="voice-question" type="text" value={question} onChange={event=>setQuestion(event.target.value)} placeholder="Ask about this result" maxLength={240}/></div><button className="secondary voice-ask" disabled={!question.trim()||loading}>{loading?'Thinking…':'Ask question'}</button></form>{error&&<p className="error voice-note" role="alert">{error}</p>}{answer&&<div className="voice-response" aria-live="polite"><p className="voice-asked">You asked: {asked}</p><p>{answer}</p><button type="button" className="text-button" disabled={preparingVoice} onClick={()=>speaking?stopSpeaking():speak(answer)}>{preparingVoice?'Preparing voice…':speaking?'Stop speaking':'Hear answer'}</button>{voiceError&&<p className="voice-note" role="status">{voiceError}</p>}</div>}</section>
}
