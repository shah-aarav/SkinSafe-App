import { clearSessionCookie, hasSession, sessionCookie } from '../lib/judge-session.js'

export async function GET(request) {
  return Response.json({ loggedIn: hasSession(request, process.env.GROQ_API_KEY) }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request) {
  const origin = request.headers.get('origin')
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: 'Request origin was not accepted.' }, { status: 403 })
  let input
  try { input = await request.json() } catch { return Response.json({ error: 'Enter your username and password.' }, { status: 400 }) }
  if (String(input.username || '').trim().toLowerCase() !== 'skinsafeapp' || input.password !== 'skinsafe') {
    return Response.json({ error: 'Username or password is incorrect.' }, { status: 401 })
  }
  if (!process.env.GROQ_API_KEY) return Response.json({ error: 'Sign-in is unavailable right now.' }, { status: 503 })
  return Response.json({ loggedIn: true }, { headers: { 'Set-Cookie': sessionCookie(process.env.GROQ_API_KEY), 'Cache-Control': 'no-store' } })
}

export async function DELETE() {
  return Response.json({ loggedIn: false }, { headers: { 'Set-Cookie': clearSessionCookie(), 'Cache-Control': 'no-store' } })
}
