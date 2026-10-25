import { createHmac, timingSafeEqual } from 'node:crypto'

const COOKIE = 'skinsafe_session'
const MAX_AGE = 60 * 60 * 24

function signature(timestamp, secret) {
  return createHmac('sha256', secret).update(`skinsafe-judge:${timestamp}`).digest('hex')
}

export function sessionCookie(secret) {
  const timestamp = Math.floor(Date.now() / 1000)
  return `${COOKIE}=${timestamp}.${signature(timestamp, secret)}; Max-Age=${MAX_AGE}; Path=/api; HttpOnly; Secure; SameSite=Lax`
}

export function clearSessionCookie() {
  return `${COOKIE}=; Max-Age=0; Path=/api; HttpOnly; Secure; SameSite=Lax`
}

export function hasSession(request, secret) {
  if (!secret) return false
  const value = request.headers.get('cookie')?.split(';').map(part => part.trim()).find(part => part.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1)
  if (!value) return false
  const [rawTime, received] = value.split('.')
  const timestamp = Number(rawTime)
  if (!Number.isSafeInteger(timestamp) || !received || !/^[a-f0-9]{64}$/.test(received)) return false
  const age = Math.floor(Date.now() / 1000) - timestamp
  if (age < 0 || age > MAX_AGE) return false
  return timingSafeEqual(Buffer.from(received, 'hex'), Buffer.from(signature(timestamp, secret), 'hex'))
}
