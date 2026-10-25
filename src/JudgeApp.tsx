import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import './judge.css'

type Code='NEV'|'BCC'|'SCC'|'ACK'|'SEK'|'MEL'
type Case={id:string;image:string;label:string;code:Code;answers:Record<string,string>;createdAt?:string;filename?:string;sha256?:string}
const advice:Record<Code,string>={
  NEV:'A nevus is a mole made of pigment-producing cells. Keep a clear photo for comparison and ask a dermatologist about a new or changing mole.',
  BCC:'Basal cell carcinoma is a common skin cancer that can grow into nearby tissue. A dermatologist can examine the area and discuss treatment.',
  SCC:'Squamous cell carcinoma is a skin cancer that can develop in sun-exposed skin. Arrange a dermatologist appointment to discuss evaluation and treatment.',
  ACK:'Actinic keratosis is a rough, sun-damaged area that can sometimes progress to skin cancer. A dermatologist can check whether treatment is needed.',
  SEK:'Seborrheic keratosis is a common, usually harmless skin growth. Have a changing or uncertain spot checked rather than treating it based on a photo alone.',
  MEL:'Melanoma is a serious form of skin cancer. Arrange a prompt dermatologist evaluation and bring the photo and notes.',
}
const serious=new Set<Code>(['BCC','SCC','MEL'])
const prompts=['What is this?','What should I do next?','What should I bring to my appointment?','What changes should I watch for?']
function prepared(question:string,item:Case){
  const q=question.trim().toLowerCase().replace(/[^a-z ]/g,'').replace(/\s+/g,' ')
  if(q==='what is this')return `This research image is recorded as ${item.label.toLowerCase()} in the PAD-UFES-20 dataset. ${advice[item.code]}`
  if(q==='what should i do next')return serious.has(item.code)
    ? `Arrange a dermatologist appointment and bring this photo and the spot details. ${advice[item.code]}`
    : `Keep this photo for comparison. ${advice[item.code]}`
  if(q==='what should i bring to my appointment')return 'Bring this photo and your notes about when you noticed the spot, how it has changed, and any itching, pain, or bleeding. Bring a list of medicines and questions too.'
  if(q==='what changes should i watch for')return 'Watch for changes in size, shape, or color, a spot that looks different from your others, or new itching, pain, or bleeding. Have a new or changing spot examined.'
  if(/(biopsy|confirm|diagnos|how.*know.*sure|how.*check)/.test(q))return 'A dermatologist can examine the spot and decide whether a skin biopsy is needed. A laboratory examination of the tissue is how skin cancer is confirmed; a photo alone cannot establish that.'
  if(/(appointment|dermatologist|doctor|specialist|clinic)/.test(q))return serious.has(item.code)?'Arrange a dermatology appointment and bring the photo, when the spot appeared, how it has changed, and any symptoms. Ask the clinic whether a referral is needed.':'If the spot is new, changing, bleeding, or worrying you, book a dermatologist appointment and bring your photo and notes.'
  if(/(cancer|dangerous|serious|spread|risk)/.test(q))return serious.has(item.code)?`${item.label} is a skin-cancer category in this research record. A dermatologist can assess what this means for an actual patient, including whether a biopsy or treatment is needed.`:`The recorded label is ${item.label.toLowerCase()}. A new or changing spot still deserves a dermatologist’s assessment; this photo cannot determine your personal risk.`
  if(/(treat|remove|surgery|mohs|cure|heal)/.test(q))return serious.has(item.code)?'Treatment depends on the diagnosis, location, size, and other clinical details. A dermatologist can explain options after examining the spot; do not try to remove or treat it yourself.':'A dermatologist can tell you whether this spot needs any treatment. Avoid removing or treating an uncertain lesion yourself.'
  if(/(cream|ointment|medicine|medication|otc|over the counter|remedy)/.test(q))return 'No over-the-counter medicine can confirm or reliably treat an uncertain skin lesion. If the spot is changing, bleeding, or persistent, ask a dermatologist before applying a treatment that might hide its appearance.'
  if(/(photo|picture|track|compare|monitor|size|growth)/.test(q))return 'Take clear photos in similar lighting and note the date, location, approximate size, and any changes or symptoms. Bring that history to a dermatologist if the spot changes or concerns you.'
  if(/(bleed|itch|pain|color|shape|border|symptom)/.test(q))return 'Note any new bleeding, itching, pain, or change in color, shape, or size. A dermatologist should assess a new or changing spot rather than relying on a photo comparison alone.'
  if(/(sun|prevent|sunscreen|uv)/.test(q))return 'Protect exposed skin with shade, clothing, and broad-spectrum sunscreen, and avoid tanning beds. Sun protection does not replace having a concerning spot examined.'
  if(/(cause|why|happen|form)/.test(q))return `${item.label} is the recorded category for this research photo. The image and record do not establish why a particular person's spot developed; a dermatologist can discuss relevant risk factors during an examination.`
  if(/(what|explain|mean|about|tell me)/.test(q))return `${item.label} is the recorded category for this research photo. ${advice[item.code]}`
  return null
}
function spoken(text:string,onSpeaking:(value:boolean)=>void){
  if(!('speechSynthesis' in window))return
  window.speechSynthesis.cancel()
  const message=new SpeechSynthesisUtterance(text)
  message.lang='en-US';message.rate=1.04
  const voices=window.speechSynthesis.getVoices()
  message.voice=voices.find(voice=>voice.lang.startsWith('en')&&/Samantha|Ava|Jenny|Aria/i.test(voice.name))||voices.find(voice=>voice.lang.startsWith('en'))||null
  message.onstart=()=>onSpeaking(true)
  message.onend=()=>onSpeaking(false)
  message.onerror=()=>onSpeaking(false)
  window.speechSynthesis.speak(message)
}
function Questions({item}:{item:Case}){
  const [question,setQuestion]=useState('')
  const [asked,setAsked]=useState('')
  const [answer,setAnswer]=useState('')
  const [error,setError]=useState('')
  const [loading,setLoading]=useState(false)
  const [speaking,setSpeaking]=useState(false)
  const requestId=useRef(0)
  useEffect(()=>{requestId.current++;setQuestion('');setAsked('');setAnswer('');setError('');window.speechSynthesis?.cancel();setSpeaking(false)},[item.id])
  useEffect(()=>()=>window.speechSynthesis?.cancel(),[])
  async function ask(value:string){
    const text=value.trim(),id=++requestId.current
    if(!text)return
    window.speechSynthesis?.cancel();setSpeaking(false);setAsked(text);setQuestion(text);setAnswer('');setError('')
    const checked=prepared(text,item)
    if(checked){setAnswer(checked);return}
    setLoading(true)
    try{
      const response=await fetch('/api/ask',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:text,code:item.code})})
      const result=await response.json()
      if(!response.ok)throw new Error(result.error||'Could not answer right now.')
      if(id===requestId.current)setAnswer(result.answer)
    }catch(cause){if(id===requestId.current)setError(cause instanceof Error?cause.message:'Could not answer right now.')}
    finally{if(id===requestId.current)setLoading(false)}
  }
  return <section className="judge-questions" aria-labelledby="judge-questions-title"><h2 id="judge-questions-title">Ask about this result</h2><div className="judge-prompts">{prompts.map(prompt=><button key={prompt} type="button" disabled={loading} onClick={()=>void ask(prompt)}>{prompt}</button>)}</div><form onSubmit={(event:FormEvent)=>{event.preventDefault();void ask(question)}}><label htmlFor="judge-question">Your question</label><div className="judge-question-row"><input id="judge-question" value={question} onChange={event=>setQuestion(event.target.value)} maxLength={300} placeholder="Ask anything about this result"/><button type="submit" disabled={!question.trim()||loading}>{loading?'Thinking…':'Ask'}</button></div></form>{error&&<p className="judge-error" role="alert">{error}</p>}{answer&&<div className="judge-answer" aria-live="polite"><span>You asked</span><p className="judge-asked">{asked}</p><p>{answer}</p><button type="button" onClick={()=>{if(speaking){window.speechSynthesis.cancel();setSpeaking(false)}else spoken(answer,setSpeaking)}}>{speaking?'Stop voice':'Hear answer'}</button></div>}</section>
}

export default function JudgeApp(){
  const [loggedIn,setLoggedIn]=useState(()=>sessionStorage.getItem('skinsafe-judge-session')==='1')
  const [username,setUsername]=useState('')
  const [password,setPassword]=useState('')
  const [loginError,setLoginError]=useState('')
  const [records,setRecords]=useState<Case[]>([])
  const [uploads,setUploads]=useState<Case[]>([])
  const [selected,setSelected]=useState<Case|null>(null)
  const [tab,setTab]=useState<'records'|'upload'>('records')
  const [loadError,setLoadError]=useState('')
  const [uploadError,setUploadError]=useState('')
  const [uploading,setUploading]=useState(false)
  useEffect(()=>{Promise.all([fetch('/judge/records.json').then(r=>r.json()),fetch('/judge/uploads.json').then(r=>r.json())]).then(([history,samples])=>{setRecords(history);setUploads(samples)}).catch(()=>setLoadError('Records could not be loaded. Refresh the page.'));if(sessionStorage.getItem('skinsafe-judge-session')==='1')fetch('/api/login').then(response=>response.json()).then(result=>{if(!result.loggedIn){sessionStorage.removeItem('skinsafe-judge-session');setLoggedIn(false)}}).catch(()=>{sessionStorage.removeItem('skinsafe-judge-session');setLoggedIn(false)})},[])
  async function logIn(event:FormEvent){event.preventDefault();setLoginError('');try{const response=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password})});const result=await response.json();if(!response.ok)throw new Error(result.error||'Sign-in failed.');sessionStorage.setItem('skinsafe-judge-session','1');setLoggedIn(true);setPassword('')}catch(cause){setLoginError(cause instanceof Error?cause.message:'Sign-in failed.')}}
  async function chooseFile(event:ChangeEvent<HTMLInputElement>){
    const file=event.target.files?.[0]
    if(!file)return
    setUploadError('');setUploading(true)
    try{
      const digest=await crypto.subtle.digest('SHA-256',await file.arrayBuffer())
      const hash=Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('')
      const match=uploads.find(item=>item.sha256===hash)
      if(!match){setUploadError('Choose one of the three sample files below. Other photos are not available in this version.');return}
      setSelected(match);window.scrollTo({top:0,behavior:'smooth'})
    }catch{setUploadError('This photo could not be opened. Try the downloaded file again.')}
    finally{setUploading(false);event.target.value=''}
  }
  if(!loggedIn)return <div className="judge-login"><header className="judge-brand"><img src="/skinsafe-mark.png" alt=""/>SkinSafe</header><main><div className="judge-login-visual"><img src="/skinsafe-mark.png" alt=""/></div><div className="judge-login-form"><h1>Welcome back.</h1><p>Your skin records, all in one place.</p><form onSubmit={logIn}><label htmlFor="judge-username">Username</label><input id="judge-username" autoComplete="username" value={username} onChange={event=>setUsername(event.target.value)} required/><label htmlFor="judge-password">Password</label><input id="judge-password" type="password" autoComplete="current-password" value={password} onChange={event=>setPassword(event.target.value)} required/><button type="submit">Log in</button>{loginError&&<p className="judge-error" role="alert">{loginError}</p>}</form></div></main></div>
  return <div className="judge-shell"><header className="judge-top"><button className="judge-brand" onClick={()=>{setSelected(null);setTab('records')}}><img src="/skinsafe-mark.png" alt=""/>SkinSafe</button><button className="judge-logout" onClick={()=>{void fetch('/api/login',{method:'DELETE'});sessionStorage.removeItem('skinsafe-judge-session');setLoggedIn(false);setSelected(null)}}>Log out</button></header><main>
    {selected?<><button className="judge-back" onClick={()=>setSelected(null)}>Back to {selected.createdAt?'all records':'sample photos'}</button><div className="judge-detail"><div className="judge-image"><img src={selected.image} alt={`Skin lesion research photo, ${selected.label}`}/></div><div className="judge-detail-content"><span className="judge-date">{selected.createdAt?new Date(selected.createdAt).toLocaleDateString(undefined,{month:'long',day:'numeric',year:'numeric'}):'New upload'}</span><h1>Conclusion</h1><p className="judge-condition">{selected.label}</p><p className="judge-source">Recorded research-image label</p><p className="judge-explain">{advice[selected.code]}</p><div className="judge-details"><h2>Spot details</h2><p>{selected.answers.region} · {selected.answers.diameter1} × {selected.answers.diameter2} mm · Age {selected.answers.age}</p><p>{['growth','change','itch','pain','bleeding'].filter(key=>selected.answers[key]==='Yes').map(key=>key==='change'?'Color or shape change':key[0].toUpperCase()+key.slice(1)).join(', ')||'No changes or symptoms recorded'}</p></div><Questions item={selected}/></div></div></>:<><div className="judge-heading"><h1>{tab==='records'?'Your records':'Check a photo'}</h1><p>{tab==='records'?`${records.length} photos and spot details in one place.`:'Choose a photo from the sample set, then upload that file below.'}</p></div><nav className="judge-tabs" aria-label="Main navigation"><button className={tab==='records'?'active':''} onClick={()=>setTab('records')} aria-current={tab==='records'?'page':undefined}>Records</button><button className={tab==='upload'?'active':''} onClick={()=>setTab('upload')} aria-current={tab==='upload'?'page':undefined}>Check a photo</button></nav>{loadError&&<p className="judge-error" role="alert">{loadError}</p>}{tab==='records'?<div className="judge-list">{records.map(item=><button className="judge-record" key={item.id} onClick={()=>setSelected(item)}><img src={item.image} alt="" loading="lazy"/><span><strong>{item.label}</strong><small>{new Date(item.createdAt!).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})}</small></span><span aria-hidden="true">→</span></button>)}</div>:<div className="judge-upload"><div className="judge-sample-list">{uploads.map((item,index)=><article key={item.id}><img src={item.image} alt={`Sample ${index+1}: skin spot`}/><div><strong>Photo {index+1}</strong><a href={item.image} download={item.filename}>Download photo</a></div></article>)}</div><input id="judge-file" type="file" accept="image/*" onChange={event=>void chooseFile(event)} disabled={uploading}/><label className="judge-file-label" htmlFor="judge-file">{uploading?'Opening photo…':'Upload a sample photo'}</label>{uploadError&&<p className="judge-error" role="alert">{uploadError}</p>}</div>}</>}
  </main><footer>SkinSafe · PAD-UFES-20 research image collection</footer></div>
}
