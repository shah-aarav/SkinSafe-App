const proxyBase = 'https://skinsafe-cac.vercel.app/__clerk'
const frontendApi = 'https://frontend-api.clerk.dev'

async function proxy(request) {
  const secret = process.env.CLERK_SECRET_KEY
  if (!secret) return new Response('Authentication is unavailable.', { status: 503 })

  const incoming = new URL(request.url)
  const path = incoming.searchParams.get('path') || ''
  if (!path || path.includes('..') || path.startsWith('/')) return new Response('Not found', { status: 404 })
  incoming.searchParams.delete('path')
  const target = new URL(`${frontendApi}/${path}${incoming.search}`)
  const headers = new Headers(request.headers)
  for (const name of ['host', 'connection', 'content-length', 'transfer-encoding']) headers.delete(name)
  headers.set('Clerk-Proxy-Url', proxyBase)
  headers.set('Clerk-Secret-Key', secret)
  const forwardedIp = request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  if (forwardedIp) headers.set('X-Forwarded-For', forwardedIp)

  const upstream = await fetch(target, {
    method: request.method,
    headers,
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
    redirect: 'manual',
    duplex: 'half',
  })
  const responseHeaders = new Headers(upstream.headers)
  const location = responseHeaders.get('location')
  if (location?.startsWith(frontendApi)) responseHeaders.set('location', location.replace(frontendApi, proxyBase))
  responseHeaders.delete('content-encoding')
  responseHeaders.delete('content-length')
  return new Response(upstream.body, { status: upstream.status, headers: responseHeaders })
}

export const GET = proxy
export const POST = proxy
export const PUT = proxy
export const PATCH = proxy
export const DELETE = proxy
