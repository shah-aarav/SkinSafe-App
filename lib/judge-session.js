import { createHmac, timingSafeEqual } from 'node:crypto'

const COOKIE = 'skinsafe_session'
const MAX_AGE = 60 * 60 * 24

const USERS = {
  skinsafeapp: { id: 'skinsafeapp', name: 'Aarav', email: 'skinsafeapp' },
  skinsafe2026: { id: 'skinsafe2026', name: 'User', email: 'skinsafe2026' },
}

function signature(timestamp, username, secret) {
  return createHmac('sha256', secret).update(`skinsafe-judge:${username}:${timestamp}`).digest('hex')
}

export function judgeUser(username) { return USERS[username] || null }

export function sessionCookie(username, secret) {
  const timestamp = Math.floor(Date.now() / 1000)
  if (!judgeUser(username)) throw new Error('Unknown judge account')
  return `${COOKIE}=${timestamp}.${username}.${signature(timestamp, username, secret)}; Max-Age=${MAX_AGE}; Path=/api; HttpOnly; Secure; SameSite=Lax`
}

export function clearSessionCookie() {
  return `${COOKIE}=; Max-Age=0; Path=/api; HttpOnly; Secure; SameSite=Lax`
}

export function sessionUser(request, secret) {
  if (!secret) return null
  const value = request.headers.get('cookie')?.split(';').map(part => part.trim()).find(part => part.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1)
  if (!value) return null
  const [rawTime, username, received] = value.split('.')
  const timestamp = Number(rawTime)
  if (!Number.isSafeInteger(timestamp) || !judgeUser(username) || !received || !/^[a-f0-9]{64}$/.test(received)) return null
  const age = Math.floor(Date.now() / 1000) - timestamp
  if (age < 0 || age > MAX_AGE) return null
  return timingSafeEqual(Buffer.from(received, 'hex'), Buffer.from(signature(timestamp, username, secret), 'hex')) ? judgeUser(username) : null
}

export function hasSession(request, secret) { return sessionUser(request, secret) !== null }
