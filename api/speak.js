import { hasSession } from '../lib/judge-session.js'

const usage = new Map()

export async function POST(request) {
  const origin = request.headers.get('origin')
  if (origin && origin !== new URL(request.url).origin) return Response.json({error:'Request origin was not accepted.'},{status:403})
  const key = process.env.GROQ_API_KEY
  if (!hasSession(request,key)) return Response.json({error:'Please log in again.'},{status:401})
  if (Number(request.headers.get('content-length')||0)>1000) return Response.json({error:'Speech request is too long.'},{status:413})
  let input
  try { input=await request.json() } catch { return Response.json({error:'Enter text to hear.'},{status:400}) }
  const text=typeof input.text==='string' ? input.text.trim() : ''
  if (!text || text.length>190 || /[\x00-\x08\x0e-\x1f]/.test(text)) return Response.json({error:'Speech request is too long.'},{status:400})
  const ip=request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'unknown'
  const now=Date.now()
  const previous=usage.get(ip)
  const window=previous&&now-previous.started<60_000 ? previous : {started:now,count:0}
  if(window.count>=8)return Response.json({error:'Speech is busy. Try again shortly.'},{status:429})
  window.count++
  usage.set(ip,window)
  if(!key)return Response.json({error:'Speech is unavailable right now.'},{status:503})
  let upstream
  try {
    upstream=await fetch('https://api.groq.com/openai/v1/audio/speech',{
      method:'POST',
      headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},
      body:JSON.stringify({model:'canopylabs/orpheus-v1-english',voice:'autumn',input:text,response_format:'wav'}),
      signal:AbortSignal.timeout(20_000),
    })
  } catch(error) {
    console.error('Speech request failed:',error?.message)
    return Response.json({error:'Speech is unavailable right now.'},{status:502})
  }
  if(!upstream.ok){
    const detail=await upstream.json().catch(()=>({}))
    console.error('Speech response:',upstream.status,String(detail.error?.message||detail.error?.code||'unknown').slice(0,200))
    return Response.json({error:'Speech is unavailable right now.'},{status:upstream.status===429?429:502})
  }
  return new Response(upstream.body,{headers:{'Content-Type':'audio/wav','Cache-Control':'no-store'}})
}
