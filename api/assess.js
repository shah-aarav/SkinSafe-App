import { hasAppSession } from '../lib/app-auth.js'
import { knownSampleFor } from '../known-samples.mjs'

export async function POST(request){
  const origin=request.headers.get('origin')
  if(origin&&origin!==new URL(request.url).origin)return Response.json({error:'Request origin was not accepted.'},{status:403})
  if(!await hasAppSession(request))return Response.json({error:'Please log in again.'},{status:401})
  if(Number(request.headers.get('content-length')||0)>6_000_000)return Response.json({error:'Photo is too large.'},{status:413})
  let input
  try{input=await request.json()}catch{return Response.json({error:'Choose a photo.'},{status:400})}
  const match=typeof input.photoData==='string'&&/^data:image\/(?:jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(input.photoData)
  if(!match)return Response.json({error:'Choose a JPG, PNG, or WebP photo.'},{status:400})
  const photo=Buffer.from(match[1],'base64')
  if(photo.length>4_000_000)return Response.json({error:'Photo is too large.'},{status:413})
  const referenceImage=await knownSampleFor(photo)
  if(!referenceImage)return Response.json({error:'This online version can check the three supplied research photos. Choose one from the SkinSafe assets page.'},{status:422})
  return Response.json({flagged:referenceImage.code!=='NEV',modelVersion:'PAD-UFES-20 research record',referenceImage},{headers:{'Cache-Control':'no-store'}})
}
