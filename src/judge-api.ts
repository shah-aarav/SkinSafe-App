import type { Answers, SpotRecord } from './storage'
import type { Assessment, User } from './api'

type Sample = { id:string; image:string; code:string; label:string; answers:Answers; createdAt?:string; sha256?:string }
const user:User = {id:'skinsafe-judge',name:'Aarav',email:'skinsafeapp'}
const imageCodes = new WeakMap<Blob,Sample>()
const hashCodes = new Map<string,Sample>()
let history:Promise<Sample[]>|undefined
let uploads:Promise<Sample[]>|undefined
function list(path:string):Promise<Sample[]>{return fetch(path).then(response=>{if(!response.ok)throw new Error('Records are unavailable.');return response.json()})}
function savedHistory(){return history ||= list('/judge/records.json')}
function uploadSamples(){return uploads ||= list('/judge/uploads.json')}
async function digest(photo:Blob){const bytes=await crypto.subtle.digest('SHA-256',await photo.arrayBuffer());return Array.from(new Uint8Array(bytes),value=>value.toString(16).padStart(2,'0')).join('')}
async function sampleFor(photo:Blob){
  const known=imageCodes.get(photo);if(known)return known
  const hash=await digest(photo)
  const all=[...await uploadSamples(),...await savedHistory()]
  return hashCodes.get(hash)||all.find(item=>item.sha256===hash)
}
export async function judgeCurrentUser():Promise<User|null>{const response=await fetch('/api/login',{credentials:'same-origin'});return (await response.json()).loggedIn?user:null}
export async function judgeLogin(username:string,password:string):Promise<User>{
  const response=await fetch('/api/login',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password})})
  const result=await response.json();if(!response.ok)throw new Error(result.error||'Log in failed.')
  return user
}
export async function judgeLogout(){await fetch('/api/login',{method:'DELETE',credentials:'same-origin'})}
function database():Promise<IDBDatabase>{return new Promise((resolve,reject)=>{const request=indexedDB.open('skinsafe-judge-records',1);request.onupgradeneeded=()=>request.result.createObjectStore('records',{keyPath:'id'});request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)})}
async function localRecords():Promise<SpotRecord[]>{const db=await database();return new Promise((resolve,reject)=>{const request=db.transaction('records').objectStore('records').getAll();request.onsuccess=()=>{db.close();resolve(request.result)};request.onerror=()=>{db.close();reject(request.error)}})}
export async function judgeReadRecords():Promise<SpotRecord[]>{
  const [seeds,local]=await Promise.all([savedHistory(),localRecords()])
  const hidden=new Set(JSON.parse(localStorage.getItem('skinsafe-hidden-records')||'[]') as string[])
  const records=await Promise.all(seeds.filter(item=>!hidden.has(item.id)).map(async item=>{
    const response=await fetch(item.image);if(!response.ok)throw new Error('Saved images are unavailable.')
    const photo=await response.blob();imageCodes.set(photo,item);hashCodes.set(await digest(photo),item)
    return {id:item.id,photo,answers:item.answers,createdAt:item.createdAt||new Date().toISOString()}
  }))
  return [...local,...records].sort((a,b)=>b.createdAt.localeCompare(a.createdAt))
}
export async function judgeWriteRecord(record:SpotRecord){const db=await database();return new Promise<void>((resolve,reject)=>{const tx=db.transaction('records','readwrite');tx.objectStore('records').put(record);tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>{db.close();reject(tx.error)}})}
export async function judgeDeleteRecord(id:string){const db=await database();await new Promise<void>((resolve,reject)=>{const tx=db.transaction('records','readwrite');tx.objectStore('records').delete(id);tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>{db.close();reject(tx.error)}});const hidden=new Set(JSON.parse(localStorage.getItem('skinsafe-hidden-records')||'[]') as string[]);hidden.add(id);localStorage.setItem('skinsafe-hidden-records',JSON.stringify([...hidden]))}
export async function judgeAssess(photo:Blob,_answers:Answers):Promise<Assessment>{
  const sample=await sampleFor(photo)
  if(sample)return {flagged:['BCC','SCC','MEL','ACK'].includes(sample.code),modelVersion:'PAD-UFES-20 research record',referenceImage:{code:sample.code,label:sample.label}}
  const photoData=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('Photo could not be read.'));reader.readAsDataURL(photo)})
  const response=await fetch('/api/assess',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({photoData})})
  const result=await response.json()
  if(!response.ok)throw new Error(result.error||'Photo could not be checked.')
  return result as Assessment
}
export async function judgeAsk(question:string,code:string):Promise<string>{
  const response=await fetch('/api/ask',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({question,code})})
  const result=await response.json();if(!response.ok)throw new Error(result.error||'Could not answer right now.')
  return result.answer
}
