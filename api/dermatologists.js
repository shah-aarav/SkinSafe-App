import { hasSession } from '../lib/judge-session.js'
import { findDermatologyOffices } from '../clinic-search.mjs'

export async function GET(request){
  if(!hasSession(request,process.env.GROQ_API_KEY))return Response.json({error:'Please log in again.'},{status:401})
  const zip=new URL(request.url).searchParams.get('zip')||''
  try{return Response.json(await findDermatologyOffices(zip),{headers:{'Cache-Control':'private, max-age=300'}})}
  catch(error){return Response.json({error:error.message||'The provider directory is unavailable.'},{status:error.status||502})}
}
