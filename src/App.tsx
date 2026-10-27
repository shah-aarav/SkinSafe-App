import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import type { Answers, SpotRecord } from './storage'
import { activateAccount, assessSpot, currentUser, logout, readAccountRecords, writeAccountRecord, deleteAccountRecord, findDermatologists } from './api'
import type { Assessment, User, DermatologyOffice } from './api'
import Entry from './Entry'
import VoiceGuide from './VoiceGuide'

type Screen = 'home' | 'photo' | 'spot' | 'changes' | 'you' | 'review' | 'about' | 'saved'
const regions = ['Face', 'Scalp', 'Ear', 'Lip', 'Nose', 'Neck', 'Chest', 'Abdomen', 'Back', 'Arm', 'Forearm', 'Hand', 'Thigh', 'Lower leg', 'Foot', 'Other / not sure']
const symptoms = [['itch', 'Does it itch?'], ['growth', 'Has it grown?'], ['pain', 'Does it hurt?'], ['change', 'Has its color or shape changed?'], ['bleeding', 'Has it bled?'], ['elevation', 'Is it raised above the skin?']]
const skinTypes = ['I — Always burns, never tans', 'II — Usually burns, tans a little', 'III — Sometimes burns, gradually tans', 'IV — Rarely burns, tans easily', 'V — Very rarely burns, tans deeply', 'VI — Never burns, deeply pigmented', 'Not sure']
const labels: Record<string,string> = {region:'Location', diameter1:'Longest diameter (mm)',diameter2:'Width across it (mm)',age:'Age',gender:'Gender',skinType:'Sun response (Fitzpatrick type)',priorSkinCancer:'Previous skin cancer',priorCancer:'Previous other cancer',itch:'Itch',growth:'Growth',pain:'Pain',change:'Color or shape change',bleeding:'Bleeding',elevation:'Raised'}
const conditionDescriptions:Record<string,string>={
  NEV:'A nevus is a mole made of clustered pigment-producing cells. Most moles do not need medicine or removal.',
  BCC:'Basal cell carcinoma is a type of skin cancer that often grows slowly but can extend into nearby tissue.',
  SCC:'Squamous cell carcinoma is a skin cancer that can grow into deeper tissue if untreated.',
  ACK:'Actinic keratosis is a rough area of sun-damaged skin. A dermatologist can assess whether it needs treatment.',
  SEK:'Seborrheic keratosis is a common skin growth that can look waxy or raised.',
  MEL:'Melanoma is a skin cancer that can develop in a new or changing pigmented spot.',
}
const conditionSteps:Record<string,string[]>={
  NEV:['Keep this photo as a baseline and compare the spot over time.','Book a skin exam if the mole is new, changes in size, shape, or color, bleeds, or looks unlike your other moles.'],
  BCC:['Arrange a dermatologist visit to examine the spot and decide whether a biopsy is needed.','Ask about removal options, including excision or Mohs surgery; selected superficial cases may have prescription cream options.'],
  SCC:['Arrange a dermatologist visit soon. A clinician can examine the spot and decide whether a biopsy is needed.','Ask how it would be removed and whether the location or size changes the treatment plan.'],
  ACK:['Have a dermatologist examine the rough area and check the surrounding sun-exposed skin.','Ask whether freezing the spot or a prescription field treatment would be appropriate.'],
  SEK:['Keep a photo for comparison. Most seborrheic keratoses do not need treatment.','Have it examined if it changes quickly, bleeds, becomes irritated, or looks different from your other spots.'],
  MEL:['Arrange a prompt in-person dermatology examination and bring this photo and your notes.','Ask whether a biopsy is needed and what the next steps would be if melanoma is confirmed.'],
}
function Icon({name, size=22}: {name:string;size?:number}) {
  const paths: Record<string,React.ReactNode> = {
    camera: <><path d="M4 7h4l2-3h4l2 3h4a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z"/><circle cx="12" cy="13" r="4"/></>,
    image:<><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 5-5 4 4 4-6 5 7"/></>,
    arrow:<path d="M5 12h14m-5-5 5 5-5 5"/>, back:<path d="m14 6-6 6 6 6"/>,
    check:<path d="m5 12 4 4L19 6"/>, lock:<><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>,
    info:<><circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.1"/></>, download:<><path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5"/></>,
    bookmark:<path d="M6 3h12v18l-6-4-6 4Z"/>, close:<path d="m6 6 12 12M6 18 18 6"/>,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.info}</svg>
}

function Choice({label,name,value,onChange}: {label:string;name:string;value?:string;onChange:(key:string,value:string)=>void}) {
  return <fieldset className="choice"><legend>{label}</legend><div className="choices">{['Yes','No','Not sure'].map(option=><label key={option} className={value===option?'selected':''}><input type="radio" name={name} value={option} checked={value===option} onChange={()=>onChange(name,option)} required/><span>{option}</span></label>)}</div></fieldset>
}
function SavedThumbnail({photo}:{photo:Blob}) {
  const [url,setUrl]=useState('')
  useEffect(()=>{const next=URL.createObjectURL(photo);setUrl(next);return()=>URL.revokeObjectURL(next)},[photo])
  return url?<img src={url} alt="Saved skin spot"/>:null
}

function TreatmentInfo({code}:{code:string}){
  if(code==='NEV')return <div className="otc-option"><strong>Medicine and care</strong><p>Most moles need no medicine. Keep the photo for comparison, and ask a dermatologist about a new or changing mole.</p><a href="https://www.aad.org/public/diseases/a-z/moles-treatment" target="_blank" rel="noopener noreferrer">About mole care</a></div>
  if(code==='BCC')return <div className="otc-option"><strong>Treatments to discuss</strong><p>For a confirmed superficial basal cell carcinoma, a dermatologist may consider prescription imiquimod or fluorouracil (5-FU) cream. Surgery or Mohs surgery may be more appropriate, depending on the lesion.</p><a href="https://www.aad.org/public/diseases/skin-cancer/basal-cell-carcinoma/" target="_blank" rel="noopener noreferrer">About BCC treatment</a></div>
  if(code==='SCC')return <div className="otc-option"><strong>Treatments to discuss</strong><p>Localized squamous cell carcinoma is commonly treated with surgical excision or Mohs surgery. For certain advanced cases, a cancer specialist may consider prescription medicines such as cemiplimab.</p><a href="https://www.aad.org/public/diseases/skin-cancer/squamous-cell-carcinoma/" target="_blank" rel="noopener noreferrer">About SCC treatment</a></div>
  if(code==='ACK')return <div className="otc-option"><strong>Treatments to discuss</strong><p>A dermatologist may freeze an actinic keratosis or prescribe a treatment such as fluorouracil (5-FU), imiquimod, or tirbanibulin for suitable areas.</p><a href="https://www.aad.org/public/diseases/skin-cancer/actinic-keratosis-treatment" target="_blank" rel="noopener noreferrer">About actinic keratosis treatment</a></div>
  if(code==='SEK')return <div className="otc-option"><strong>Medicine and care</strong><p>Most seborrheic keratoses need no medicine. If one is irritated or needs removal, a dermatologist may use freezing or another office procedure.</p><a href="https://www.aad.org/public/diseases/a-z/seborrheic-keratoses-treatment" target="_blank" rel="noopener noreferrer">About seborrheic keratosis care</a></div>
  if(code==='MEL')return <div className="otc-option"><strong>Treatments to discuss</strong><p>Melanoma treatment usually begins with surgery. Further treatment depends on its depth and whether it has spread; a specialist can explain those options after an exam and biopsy.</p><a href="https://www.aad.org/public/diseases/skin-cancer/types/common/melanoma/diagnose-treat" target="_blank" rel="noopener noreferrer">About melanoma treatment</a></div>
  return null
}

function ClinicFinder() {
  const [zip,setZip]=useState('')
  const [searchedZip,setSearchedZip]=useState('')
  const [area,setArea]=useState('')
  const [offices,setOffices]=useState<DermatologyOffice[]>([])
  const [loading,setLoading]=useState(false)
  const [error,setError]=useState('')
  async function search(event:FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if(!/^\d{5}$/.test(zip)){setError('Enter a five-digit U.S. ZIP code.');return}
    setLoading(true);setError('');setSearchedZip('');setOffices([])
    try{const result=await findDermatologists(zip);setOffices(result.offices);setArea(result.area);setSearchedZip(zip)}
    catch(cause){setError(cause instanceof Error?cause.message:'The directory is unavailable. Try again later.')}
    finally{setLoading(false)}
  }
  return <section className="clinic-finder" aria-labelledby="clinic-title"><h2 id="clinic-title">Find a dermatologist</h2><p>Search public provider listings by ZIP code.</p><form onSubmit={search}><label htmlFor="clinic-zip">ZIP code</label><div className="clinic-search-row"><input id="clinic-zip" type="text" inputMode="numeric" autoComplete="postal-code" pattern="[0-9]{5}" maxLength={5} value={zip} onChange={event=>setZip(event.target.value.replace(/\D/g,'').slice(0,5))} required/><button className="secondary" disabled={loading}>{loading?'Searching…':'Search'}</button></div></form><p className="clinic-privacy">Your ZIP and city are used to search public directories. Your photo and answers are not shared.</p>{error&&<p className="error" role="alert">{error}</p>}{searchedZip&&<div className="clinic-results" aria-live="polite"><p className="clinic-count">{offices.length?`Dermatology listings in ${area}`:`No listings found for ${searchedZip}`}</p>{offices.length?<ul>{offices.map(office=>{const address=[office.address1,office.address2,office.city,office.state,office.zip].filter(Boolean).join(', ');const phone=office.phone.replace(/[^\d+]/g,'');return <li key={`${office.npi}-${office.address1}`}><strong>{office.name}</strong><span>{address}</span><div className="clinic-links">{phone&&<a href={`tel:${phone}`}>Call</a>}<a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`} target="_blank" rel="noopener noreferrer">Directions</a><a href={`https://npiregistry.cms.hhs.gov/provider-view/${office.npi}`} target="_blank" rel="noopener noreferrer">Listing</a></div></li>})}</ul>:<p>Try another ZIP code or use the <a href="https://find-a-derm.aad.org/" target="_blank" rel="noopener noreferrer">AAD dermatologist finder</a>.</p>}<p className="clinic-caveat">Listings may include other ZIP codes in your city and are not ranked by distance or quality. Call to confirm location, insurance, and appointments.</p></div>}</section>
}

export default function App({clerkAccount=null,clerkReady=false,signOutClerk}: {clerkAccount?:User|null;clerkReady?:boolean;signOutClerk?:()=>Promise<void>}) {
  const [user,setUser] = useState<User|null>(null)
  const [authReady,setAuthReady] = useState(false)
  const [screen,setScreen] = useState<Screen>('home')
  const [returnTo,setReturnTo] = useState<Screen>('photo')
  const [photo,setPhoto] = useState<Blob>()
  const [photoUrl,setPhotoUrl] = useState('')
  const [answers,setAnswers] = useState<Answers>({})
  const [error,setError] = useState('')
  const [status,setStatus] = useState('')
  const [busy,setBusy] = useState(false)
  const [assessment,setAssessment] = useState<Assessment>()
  const [assessing,setAssessing] = useState(false)
  const [assessmentError,setAssessmentError] = useState('')
  const assessmentRequest = useRef(0)
  const [confirmed,setConfirmed] = useState(false)
  const [saved,setSaved] = useState<SpotRecord[]>([])
  const [recordId,setRecordId] = useState<string>()
  const [createdAt,setCreatedAt] = useState(new Date().toISOString())
  const [showDiscard,setShowDiscard] = useState(false)
  const [deleteConfirm,setDeleteConfirm] = useState<string>()
  const camera = useRef<HTMLInputElement>(null)
  const library = useRef<HTMLInputElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const assessmentHeading = useRef<HTMLHeadingElement>(null)
  const firstRender = useRef(true)
  useEffect(()=>{if(!clerkReady)return;let active=true;currentUser().then(found=>{if(active)setUser(clerkAccount||found)}).catch(()=>{if(active)setUser(clerkAccount)}).finally(()=>{if(active)setAuthReady(true)});return()=>{active=false}},[clerkAccount?.id,clerkReady])
  useEffect(()=>{if(user)activateAccount(user)},[user?.id])
  useEffect(()=>{let active=true;setSaved([]);if(user)readAccountRecords().then(records=>{if(active)setSaved(records)}).catch(()=>{if(active)setError('Your saved records could not be loaded.')});return()=>{active=false}},[user?.id])
  useEffect(()=>{if(!photo){setPhotoUrl(''); return}const url=URL.createObjectURL(photo);setPhotoUrl(url);return()=>URL.revokeObjectURL(url)},[photo])
  useEffect(()=>{if(firstRender.current){firstRender.current=false;return}window.scrollTo({top:0});heading.current?.focus()},[screen])
  useEffect(()=>{if(assessment||assessmentError)assessmentHeading.current?.focus()},[assessment,assessmentError])
  function clearAssessment(){assessmentRequest.current++;setAssessment(undefined);setAssessmentError('');setAssessing(false)}
  const update=(key:string,value:string)=>{clearAssessment();setAnswers(previous=>({...previous,[key]:value}));setStatus('')}
  const unsupported = ['Lower leg','Other / not sure'].includes(answers.region) ? 'This location is outside the model’s supported options.' : ['Another identity','Prefer not to say'].includes(answers.gender) ? 'The model only supports the Female and Male categories in its research data.' : ['skinType','priorSkinCancer','priorCancer'].some(key=>answers[key]==='Not sure') ? 'The model cannot assess an unknown sun response or cancer history.' : ''
  const incomplete = Object.keys(labels).some(key=>!answers[key])
  const warningSigns = ['growth','change','bleeding','itch','pain'].some(key=>answers[key]==='Yes')
  const needsReview = Boolean(assessment?.flagged || warningSigns)
  const careSteps=assessment?.referenceImage?conditionSteps[assessment.referenceImage.code]||[]:needsReview?['Arrange a dermatologist exam and bring this photo and notes.','A clinician can examine the spot and decide whether a biopsy is needed.']:['Keep this photo as a baseline and compare it over time.','Arrange a dermatologist exam if the spot changes or concerns you.']
  async function assess(sourcePhoto=photo,sourceAnswers=answers){
    if(!sourcePhoto || Object.keys(labels).some(key=>!sourceAnswers[key]) || ['Lower leg','Other / not sure'].includes(sourceAnswers.region) || ['Another identity','Prefer not to say'].includes(sourceAnswers.gender) || ['skinType','priorSkinCancer','priorCancer'].some(key=>sourceAnswers[key]==='Not sure'))return
    const id=++assessmentRequest.current;setAssessing(true);setAssessmentError('')
    try{const result=await assessSpot(sourcePhoto,sourceAnswers);if(id===assessmentRequest.current)setAssessment(result)}
    catch(cause){if(id===assessmentRequest.current)setAssessmentError(cause instanceof Error?cause.message:'Assessment unavailable. Please try again.')}
    finally{if(id===assessmentRequest.current)setAssessing(false)}
  }
  const go=(next:Screen)=>{setError('');setStatus('');setShowDiscard(false);setScreen(next)}
  const openUtility=(next:Screen)=>{if(next===screen)return;if(inFlow||screen==='home')setReturnTo(screen);go(next)}
  const flowIndex=screen==='photo'?0:screen==='review'?2:1
  const inFlow=!['home','about','saved'].includes(screen)
  async function choosePhoto(event:ChangeEvent<HTMLInputElement>) {
    const file=event.target.files?.[0];event.target.value='';if(!file)return
    setError('');setStatus('')
    if(!['image/jpeg','image/png','image/webp','image/heic','image/heif'].includes(file.type)){setError('Choose a JPG, PNG, WebP, or supported iPhone photo.');return}
    setBusy(true)
    const url=URL.createObjectURL(file)
    try {
      const img=new Image();img.src=url
      await img.decode()
      if(img.naturalWidth<300||img.naturalHeight<300){setError('This photo is too small to see clearly. Choose a larger photo.');return}
      let chosen:Blob=file
      if(['image/heic','image/heif'].includes(file.type)||file.size>20*1024*1024){
        const scale=Math.min(1,2048/Math.max(img.naturalWidth,img.naturalHeight))
        const canvas=document.createElement('canvas');canvas.width=Math.round(img.naturalWidth*scale);canvas.height=Math.round(img.naturalHeight*scale)
        const context=canvas.getContext('2d');if(!context)throw new Error('Image conversion unavailable.')
        context.drawImage(img,0,0,canvas.width,canvas.height)
        chosen=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Image conversion failed.')),'image/jpeg',0.9))
      }
      if(chosen.size>20*1024*1024){setError('This photo is too large. Choose a photo under 20 MB.');return}
      clearAssessment();setPhoto(chosen);setConfirmed(false);setCreatedAt(new Date().toISOString());setAnswers({})
    }catch{setError('This image could not be opened. Try a JPG, PNG, or another photo.')}
    finally{URL.revokeObjectURL(url);setBusy(false)}
  }
  function submit(event:FormEvent,next:Screen){event.preventDefault();go(next)}
  function reset(){clearAssessment();setPhoto(undefined);setAnswers({});setRecordId(undefined);setConfirmed(false);setCreatedAt(new Date().toISOString());go('photo')}
  async function save() {
    if(!photo)return
    setBusy(true);setError('')
    try{const record:SpotRecord={id:recordId||crypto.randomUUID(),photo,answers,createdAt};await writeAccountRecord(record);setRecordId(record.id);setSaved(previous=>[record,...previous.filter(item=>item.id!==record.id)]);setStatus('Saved to your account.')}
    catch{setError('Your record could not be saved. Please try again.')}
    finally{setBusy(false)}
  }
  async function remove(){if(!deleteConfirm)return;setBusy(true);try{await deleteAccountRecord(deleteConfirm);setSaved(previous=>previous.filter(record=>record.id!==deleteConfirm));setDeleteConfirm(undefined);setStatus('Saved record deleted.')}catch{setError('The record could not be deleted. Please try again.')}finally{setBusy(false)}}
  function download(){
    if(import.meta.env.VITE_JUDGE_PORTAL==='1'){
      const lines=['SkinSafe — spot record',`Recorded: ${new Date(createdAt).toLocaleString()}`,'',assessment?.referenceImage?`Research-image label: ${assessment.referenceImage.label}`:'No matching research image checked.','',...Object.entries(labels).map(([key,label])=>`${label}: ${answers[key]||'Not recorded'}`),'','Photo is not included in this download.']
      const url=URL.createObjectURL(new Blob([lines.join('\n')],{type:'text/plain;charset=utf-8'}));const anchor=document.createElement('a');anchor.href=url;anchor.download=`skinsafe-notes-${createdAt.slice(0,10)}.txt`;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setStatus('Notes downloaded.');return
    }
    const notes=['SkinSafe — spot record',`Recorded: ${new Date(createdAt).toLocaleString()}`,'',assessment?`Research model: ${assessment.flagged?'Flagged for clinician review.':'No flag raised. This does not rule out cancer.'}`:'Assessment: not completed for this record.',...(assessment?[`Model: ${assessment.modelVersion}`]:[]),...(assessment?.referenceImage?[`Known PAD-UFES-20 image label: ${assessment.referenceImage.label}. Exact-file match; this label was not predicted by the model.`]:[]),'This record cannot diagnose a skin condition or rule out cancer. The model missed 4 of 14 melanoma photos in its held-out test.','Next step: '+(needsReview?'Arrange a dermatologist examination and bring this photo and notes.':'Keep this photo as a baseline; see a dermatologist if the spot changes or concerns you.'),'Do not attempt to remove a spot at home. A clinician decides whether a biopsy is needed.','',...Object.entries(labels).map(([key,label])=>`${label}: ${answers[key]||'Not recorded'}`),'','Photo is not included in this download.','Questions for my clinician:'].join('\n')
    const url=URL.createObjectURL(new Blob([notes],{type:'text/plain;charset=utf-8'}));const anchor=document.createElement('a');anchor.href=url;anchor.download=`skinsafe-notes-${createdAt.slice(0,10)}.txt`;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setStatus('Notes downloaded. You choose whether to share them.')
  }
  function loadSaved(record:SpotRecord){clearAssessment();setPhoto(record.photo);setAnswers(record.answers);setCreatedAt(record.createdAt);setRecordId(record.id);setConfirmed(true);go('review');void assess(record.photo,record.answers)}
  const input=(name:string,label:string,extra:Record<string,unknown>={})=><label className="field">{label}<input name={name} value={answers[name]==='Not sure'?'':answers[name]||''} onChange={e=>update(name,e.target.value)} required {...extra}/></label>
  const select=(name:string,label:string,options:string[])=><label className="field">{label}<select name={name} value={answers[name]||''} onChange={e=>update(name,e.target.value)} required><option value="" disabled>Choose one</option>{options.map(option=><option key={option}>{option}</option>)}</select></label>

  async function signOut(){setBusy(true);setError('');try{if(user?.id.startsWith('clerk-'))await signOutClerk?.();else await logout();clearAssessment();setUser(null);setSaved([]);setPhoto(undefined);setAnswers({});setConfirmed(false);go('home')}catch{setError('Could not log out. Please try again.')}finally{setBusy(false)}}
  if(!authReady)return <div className="entry-shell"><header className="entry-header"><span className="brand"><span className="brand-symbol"/>SkinSafe</span></header><main className="entry-loading" role="status">Opening SkinSafe…</main></div>
  if(!user)return <Entry onAuth={found=>{setUser(found);go('home')}}/>
  return <div className="app-shell">
    <a className="skip-link" href="#main-content">Skip to content</a>
    <header className="topbar"><a href="#" className="brand" onClick={e=>{e.preventDefault();go('home')}} aria-label="SkinSafe home"><span className="brand-symbol"/>SkinSafe</a><div className="header-actions">{saved.length>0&&<button className="icon-button" onClick={()=>openUtility('saved')} aria-label="Saved records"><Icon name="bookmark"/></button>}<button className="quiet-button" onClick={()=>openUtility('about')}>About</button></div></header>
    {inFlow&&<nav aria-label="Check progress"><ol className="progress">{['Photo','Details','Review'].map((label,index)=><li key={label} className={index===flowIndex?'current':index<flowIndex?'complete':''} aria-current={index===flowIndex?'step':undefined}><span className="stop">{index<flowIndex&&<Icon name="check" size={12}/>}</span><span>{label}</span></li>)}</ol></nav>}
    <main id="main-content">
      {screen==='home'&&<section className="home-screen"><div className="section-heading"><h1 ref={heading} tabIndex={-1}>{user.id==='skinsafe2026'?'Hey User.':`Hi, ${user.name}.`}</h1><p>Your skin records, all in one place.</p></div>{saved.length>0&&<div className="recent-record"><div className="recent-record-heading"><h2>Latest record</h2><button className="text-button" onClick={()=>openUtility('saved')}>View all</button></div><button className="recent-record-open" onClick={()=>loadSaved(saved[0])}><SavedThumbnail photo={saved[0].photo}/><span><strong>{saved[0].answers.region||'Skin spot'}</strong><small>{new Date(saved[0].createdAt).toLocaleDateString(undefined,{month:'long',day:'numeric',year:'numeric'})}</small><span className="recent-record-action">Open record <Icon name="arrow" size={16}/></span></span></button></div>}<button className="primary home-start" onClick={reset}>Check a new spot<Icon name="arrow"/></button><p className="home-tip">Take a clear photo, answer a few questions, and keep the result with your record.</p><div className="home-bottom"><span><Icon name="lock" size={15}/>Saved on this device</span><button className="text-button" disabled={busy} onClick={signOut}>Log out</button></div></section>}
      {showDiscard&&<div className="inline-confirm" role="alert"><p>Start a new record? Unsaved changes will be cleared.</p><div className="button-row"><button className="secondary" onClick={()=>setShowDiscard(false)}>Keep working</button><button className="primary" onClick={reset}>Start new</button></div></div>}
      {screen==='photo'&&<section className="capture-screen"><div className="section-heading"><h1 ref={heading} tabIndex={-1}>{photo?'A clear view?':'Start with a photo'}</h1><p>{photo?'Check the spot is sharp and fully visible.':'One spot. Clear light. No filters.'}</p></div>
        <div className={`photo-frame ${photo?'has-photo':''}`} aria-busy={busy}>{photo?<img src={photoUrl} alt="Your selected skin spot"/>:<><span className="frame-corner top-left"/><span className="frame-corner top-right"/><Icon name="camera" size={54}/><span className="frame-corner bottom-left"/><span className="frame-corner bottom-right"/></>}{busy&&<div className="photo-loading" role="status">Opening photo…</div>}</div>
        <input ref={camera} className="file-input" type="file" accept="image/*" capture="environment" onChange={choosePhoto} tabIndex={-1} aria-label="Take a photo"/>
        <input ref={library} className="file-input" type="file" accept="image/*" onChange={choosePhoto} tabIndex={-1} aria-label="Choose a photo file"/>
        {photo?<><label className="photo-confirm"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/><span>The whole spot is in focus, without glare.</span></label><div className="actions"><button className="primary" disabled={!confirmed||busy} onClick={()=>go('spot')}>Use this photo<Icon name="arrow"/></button><button className="secondary" disabled={busy} onClick={()=>library.current?.click()}>Choose another</button><button className="text-button" disabled={busy} onClick={()=>camera.current?.click()}>Retake photo</button></div></>:<div className="actions"><button className="primary" disabled={busy} onClick={()=>camera.current?.click()}>Take a photo<Icon name="camera"/></button><button className="secondary" disabled={busy} onClick={()=>library.current?.click()}><Icon name="image"/>Choose a photo</button></div>}
        {error&&<p className="feedback error photo-error" role="alert">{error}</p>}
        <p className="privacy"><Icon name="lock" size={14}/>Uploaded only when you check or save.</p>
      </section>}
      {screen==='spot'&&<form onSubmit={e=>submit(e,'changes')}><button type="button" className="back" onClick={()=>go('photo')}><Icon name="back" size={18}/>Photo</button><div className="section-heading"><h1 ref={heading} tabIndex={-1}>About this spot</h1><p>Measure in millimeters, if you can.</p></div>
        {select('region','Where is the spot?',regions)}
        <div className="measurement-guide" aria-hidden="true"><span className="measure-spot"/><span className="measure-horizontal"/><span className="measure-vertical"/><span className="measure-label">Length × width</span></div>
        <div className="field-pair">{input('diameter1','Longest diameter (mm)',{type:'number',min:0.1,max:500,step:0.1,inputMode:'decimal',placeholder:'mm',disabled:answers.diameter1==='Not sure',required:answers.diameter1!=='Not sure'})}{input('diameter2','Width across it (mm)',{type:'number',min:0.1,max:500,step:0.1,inputMode:'decimal',placeholder:'mm',disabled:answers.diameter2==='Not sure',required:answers.diameter2!=='Not sure'})}</div>
        <label className="checkbox-row"><input type="checkbox" checked={answers.diameter1==='Not sure'} onChange={e=>{update('diameter1',e.target.checked?'Not sure':'');update('diameter2',e.target.checked?'Not sure':'')}}/>I don’t have a measurement</label><p className="helper">Use a ruler if available. Don’t estimate from the photo.</p><button className="primary continue">Continue<Icon name="arrow"/></button>
      </form>}
      {screen==='changes'&&<form onSubmit={e=>submit(e,'you')}><button type="button" className="back" onClick={()=>go('spot')}><Icon name="back" size={18}/>Spot details</button><div className="section-heading"><h1 ref={heading} tabIndex={-1}>What have you noticed?</h1><p>“Not sure” is a useful answer, too.</p></div>{symptoms.map(([name,label])=><Choice key={name} name={name} label={label} value={answers[name]} onChange={update}/>)}<button className="primary continue">Continue<Icon name="arrow"/></button></form>}
      {screen==='you'&&<form onSubmit={e=>submit(e,'review')}><button type="button" className="back" onClick={()=>go('changes')}><Icon name="back" size={18}/>Changes</button><div className="section-heading"><h1 ref={heading} tabIndex={-1}>A little about you</h1><p>These details complete your record.</p></div>{input('age','Age',{type:'number',min:0,max:120,step:1,inputMode:'numeric',placeholder:'Years'})}{select('gender','Gender',['Female','Male','Another identity','Prefer not to say'])}{select('skinType','How does your skin respond to the sun?',skinTypes)}<p className="helper">Fitzpatrick type describes burning and tanning, not race or ethnicity.</p><Choice name="priorSkinCancer" label="Have you had skin cancer?" value={answers.priorSkinCancer} onChange={update}/><Choice name="priorCancer" label="Have you had another type of cancer?" value={answers.priorCancer} onChange={update}/><button className="primary continue">Review record<Icon name="arrow"/></button></form>}
      {screen==='review'&&<section><button className="back" onClick={()=>go('you')}><Icon name="back" size={18}/>Edit details</button><div className="section-heading"><h1 ref={heading} tabIndex={-1}>Your spot record</h1><p>{new Date(createdAt).toLocaleDateString(undefined,{month:'long',day:'numeric',year:'numeric'})}</p></div><div className="review-photo"><img src={photoUrl} alt="Your recorded skin spot"/><div><strong>{answers.region||'Skin spot'}</strong><span>{answers.diameter1==='Not sure'?'Measurement not recorded':`${answers.diameter1} × ${answers.diameter2} mm`}</span><button className="text-button" onClick={()=>go('photo')}>Review photo</button></div></div>
        <div className="assessment" aria-busy={assessing}>
          <div role="status" aria-live="polite">
            {assessment?.referenceImage&&<span className="conclusion-label">Conclusion</span>}
            <h2 ref={assessmentHeading} tabIndex={-1}>{assessing?'Checking your spot…':assessment?assessment.referenceImage?.label||'Skin check result':unsupported||incomplete?'Assessment unavailable':'Check this spot'}</h2>
            {assessing?<p>Keep this page open. This may take a moment.</p>:assessment?assessment.referenceImage?null:<p className="result-flag">{assessment.flagged?'Review flag raised':'No flag raised'}</p>:unsupported?<p>{unsupported} You can still save your record. Keep your answers accurate.</p>:incomplete?<p>Complete the missing details before requesting a check.</p>:<p>{import.meta.env.VITE_JUDGE_PORTAL==='1'?'Check a supplied research photo.':'A research model checks your photo and answers for a review flag.'}</p>}
          </div>
          {assessment?.referenceImage&&<p className="sample-description">{conditionDescriptions[assessment.referenceImage.code]}</p>}
          {!assessing&&!assessment&&!unsupported&&!incomplete&&<><button className="primary assessment-action" onClick={()=>void assess()}>{assessmentError?'Try again':'Check this spot'}<Icon name="arrow"/></button>{import.meta.env.VITE_JUDGE_PORTAL!=='1'&&<p className="helper">Sends your photo and answers to this local server.</p>}</>}
          {assessmentError&&<p className="error" role="alert">{assessmentError}</p>}
        </div>
        {assessment&&<><VoiceGuide key={`${recordId||createdAt}-${assessment.flagged}`} flagged={assessment.flagged} warningSigns={warningSigns} referenceCode={assessment.referenceImage?.code}/><section className="care-plan" aria-labelledby="care-plan-title"><h2 id="care-plan-title">What to do next</h2><ol>{careSteps.map(step=><li key={step}>{step}</li>)}</ol>{assessment.referenceImage&&<TreatmentInfo code={assessment.referenceImage.code}/>} {!needsReview&&!assessment.referenceImage&&<div className="otc-option"><strong>OTC medicine for minor irritation</strong><p>If you also have a separate mild itchy rash on intact skin, 1% hydrocortisone cream may temporarily relieve it. Follow the package directions; stop and ask a clinician if it worsens or lasts more than 7 days. Do not use it to treat the photographed spot.</p><div className="otc-links"><a href="https://www.cvs.com/shop/cvs-maximum-strength-hydrocortisone-1-anti-itch-cream-1-oz-prodid-397141?skuId=397141" target="_blank" rel="noopener noreferrer">Shop at CVS</a><a href="https://www.walgreens.com/q/hydrocortisone-cream" target="_blank" rel="noopener noreferrer">Shop at Walgreens</a></div><p>For everyday sun protection, choose broad-spectrum SPF 30+ sunscreen.</p></div>}<p>Treatment depends on a professional diagnosis. <a href="https://www.aad.org/public/diseases/skin-cancer/" target="_blank" rel="noopener noreferrer">Read dermatologist guidance</a></p></section><ClinicFinder key={recordId||createdAt}/></>}
        <details className="summary"><summary>Your answers<span>{Object.keys(answers).length} details</span></summary><dl>{Object.entries(labels).map(([key,label])=><div key={key}><dt>{label}</dt><dd>{answers[key]||'Not recorded'}</dd></div>)}</dl></details>
        <div className="actions"><button className="primary" disabled={busy} onClick={()=>save()}><Icon name="bookmark"/>{busy?'Saving…':recordId?'Update saved record':'Save to your account'}</button><button className="secondary" onClick={download}><Icon name="download"/>Download notes</button></div><button className="text-button new-record" onClick={()=>recordId?reset():setShowDiscard(true)}>Start a new record</button>
      </section>}
      {screen==='about'&&(import.meta.env.VITE_JUDGE_PORTAL==='1'?<section className="about"><button className="back" onClick={()=>go(returnTo)}><Icon name="back" size={18}/>Back</button><div className="section-heading"><h1 ref={heading} tabIndex={-1}>About SkinSafe</h1><p>SkinSafe was created by a team of high school students for the 2026 Congressional App Challenge.</p></div><h2>Image credits</h2><p>The skin images used in SkinSafe come from the PAD-UFES-20 research dataset by André G. C. Pacheco and collaborators.</p><p className="source-note"><a href="https://data.mendeley.com/datasets/zr7vgbcyr2/1" target="_blank" rel="noopener noreferrer">PAD-UFES-20 dataset</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0 license</a></p></section>:<section className="about"><button className="back" onClick={()=>go(returnTo)}><Icon name="back" size={18}/>Back</button><div className="section-heading"><h1 ref={heading} tabIndex={-1}>A record, not a diagnosis</h1><p>Photograph one spot, add details, and request a research-model check.</p></div><h2>About the research</h2><p>The model scored 90.4% accuracy on 459 held-out PAD-UFES-20 photos, with patients kept separate between training and testing.</p><p>It missed 4 of 14 melanoma photos. A result cannot rule out cancer.</p><p>The dataset covers six lesion categories, not all skin conditions. The model has no external clinical validation or fairness evaluation across skin tones. Incomplete answers have not been validated. Some answers are unsupported; keep your answers accurate even when a check is unavailable.</p><h2>Your privacy</h2><p>Check this spot sends your photo and answers to this local server for assessment. Save stores photos and answers in your account. Assessment results are not saved to your account; download notes to keep the current result.</p><p>Clinic search sends a ZIP code to a postal lookup and ZIP or city to the public CMS provider directory. It does not send your photo or answers. Typed questions and the review flag are sent to the configured answer provider, but the photo is not. Spoken answers use your browser’s speech service.</p><p>Passwords are stored as hashes. This local setup is not a hosted medical-data service.</p><h2>On your iPhone</h2><p>With your phone and computer on the same Wi-Fi, you can open SkinSafe in Safari and add it to your Home Screen. Keep the computer running. Local HTTP is not encrypted, so use test accounts and non-sensitive photos only. Type a question or use keyboard dictation.</p><p className="source-note">Research dataset: PAD-UFES-20 · CC BY 4.0. Full evaluation is included in the project’s model card.</p></section>)}
      {screen==='saved'&&<section><button className="back" onClick={()=>go(returnTo)}><Icon name="back" size={18}/>Back</button><div className="section-heading"><h1 ref={heading} tabIndex={-1}>Saved to your account</h1><p>{saved.length?`${saved.length} spot ${saved.length===1?'record':'records'}.`:'No saved records yet.'}</p></div>{saved.length?<ul className="saved-list">{saved.map(record=><li key={record.id}><SavedThumbnail photo={record.photo}/><div><strong>{record.answers.region||'Skin spot'}</strong><span>{new Date(record.createdAt).toLocaleDateString()}</span><button className="text-button" onClick={()=>loadSaved(record)}>Open record</button></div><button className="text-button" onClick={()=>setDeleteConfirm(record.id)} aria-label={`Delete ${record.answers.region||'spot'} record`}>Delete</button></li>)}</ul>:<button className="primary" onClick={()=>go('photo')}>Start a record</button>}{deleteConfirm&&<div className="inline-confirm"><p>Delete this saved photo and its answers? This cannot be undone.</p><div className="button-row"><button className="secondary" onClick={()=>setDeleteConfirm(undefined)}>Keep it</button><button className="primary" disabled={busy} onClick={remove}>Delete record</button></div></div>}</section>}
      {error&&screen!=='photo'&&<p className="feedback error" role="alert">{error}</p>}{status&&<p className="feedback" role="status"><Icon name="check" size={18}/>{status}</p>}
    </main>
    {inFlow&&<footer>SkinSafe cannot diagnose a skin condition.</footer>}
  </div>
}
