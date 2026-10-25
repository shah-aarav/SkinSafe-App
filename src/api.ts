import type { Answers, SpotRecord } from './storage'
import * as judge from './judge-api'

const judgeMode=import.meta.env.VITE_JUDGE_PORTAL==='1'

export type User = { id: string; name: string; email: string }
export type ReferenceImage = { code:string; label:string }
export type Assessment = { flagged: boolean; modelVersion: string; referenceImage?:ReferenceImage|null }
export type DermatologyOffice = { npi:string; name:string; address1:string; address2:string; city:string; state:string; zip:string; phone:string }
export async function findDermatologists(zip:string){return await request<{offices:DermatologyOffice[];area:string}>(`/api/dermatologists?zip=${encodeURIComponent(zip)}`)}
function photoDataUrl(photo:Blob){
  return new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('Photo could not be read.'));reader.readAsDataURL(photo)})
}
export async function assessSpot(photo:Blob,answers:Answers):Promise<Assessment>{
  if(judgeMode)return judge.judgeAssess(photo,answers)
  const result=await request<Assessment>('/api/assess','POST',{photoData:await photoDataUrl(photo),answers})
  if(typeof result.flagged!=='boolean'||typeof result.modelVersion!=='string')throw new Error('Assessment unavailable. Please try again.')
  return result
}
export async function askAboutResult(question:string,result:{flagged:boolean;warningSigns:boolean},code?:string):Promise<string>{
  if(judgeMode)return judge.judgeAsk(question,code||'NEV')
  const response=await request<{answer:string}>('/api/ask','POST',{question,result})
  if(typeof response.answer!=='string'||!response.answer.trim())throw new Error('No answer was returned. Try again.')
  return response.answer
}
async function request<T>(path:string, method='GET', data?:unknown):Promise<T> {
  const response = await fetch(path,{method,credentials:'same-origin',headers:data?{'Content-Type':'application/json'}:undefined,body:data?JSON.stringify(data):undefined})
  const result = await response.json().catch(()=>({error:'Server unavailable. Try again.'}))
  if(!response.ok) throw new Error(result.error || 'Please try again.')
  return result as T
}
export async function currentUser(){ if(judgeMode)return judge.judgeCurrentUser();return (await request<{user:User|null}>('/api/me')).user }
export async function register(name:string,email:string,password:string){if(judgeMode)throw new Error('Use the provided account to log in.'); return (await request<{user:User}>('/api/register','POST',{name,email,password})).user }
export async function login(email:string,password:string){if(judgeMode)return judge.judgeLogin(email,password); return (await request<{user:User}>('/api/login','POST',{email,password})).user }
export async function logout(){if(judgeMode)return judge.judgeLogout(); await request('/api/logout','POST') }
export async function readAccountRecords():Promise<SpotRecord[]>{
  if(judgeMode)return judge.judgeReadRecords()
  const {records}=await request<{records:{id:string;photoData:string;answers:Answers;createdAt:string}[]}>('/api/records')
  return records.map(record=>{
    const [header,base64]=record.photoData.split(',')
    const bytes=Uint8Array.from(atob(base64),char=>char.charCodeAt(0))
    return {id:record.id,photo:new Blob([bytes],{type:header.slice(5,-7)}),answers:record.answers,createdAt:record.createdAt}
  })
}
export async function writeAccountRecord(record:SpotRecord){
  if(judgeMode)return judge.judgeWriteRecord(record)
  const photoData=await photoDataUrl(record.photo)
  await request('/api/records','PUT',{id:record.id,photoData,answers:record.answers,createdAt:record.createdAt})
}
export async function deleteAccountRecord(id:string){if(judgeMode)return judge.judgeDeleteRecord(id);await request(`/api/records/${encodeURIComponent(id)}`,'DELETE')}
