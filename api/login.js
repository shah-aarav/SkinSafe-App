import { clearSessionCookie, judgeUser, sessionCookie, sessionUser } from '../lib/judge-session.js'

export async function GET(request) {
  const user = sessionUser(request, process.env.GROQ_API_KEY)
  return Response.json({ loggedIn: Boolean(user), user }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request) {
  const origin = request.headers.get('origin')
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: 'Request origin was not accepted.' }, { status: 403 })
  let input
  try { input = await request.json() } catch { return Response.json({ error: 'Enter your username and password.' }, { status: 400 }) }
  const username=String(input.username || '').trim().toLowerCase()
  const valid=(username==='skinsafeapp'&&input.password==='skinsafe')||(username==='skinsafe2026'&&input.password==='skinsafe2026')
  if (!valid) {
    return Response.json({ error: 'Username or password is incorrect.' }, { status: 401 })
  }
  if (!process.env.GROQ_API_KEY) return Response.json({ error: 'Sign-in is unavailable right now.' }, { status: 503 })
  return Response.json({ loggedIn: true, user: judgeUser(username) }, { headers: { 'Set-Cookie': sessionCookie(username,process.env.GROQ_API_KEY), 'Cache-Control': 'no-store' } })
}

export async function DELETE() {
  return Response.json({ loggedIn: false }, { headers: { 'Set-Cookie': clearSessionCookie(), 'Cache-Control': 'no-store' } })
}
