import { sendAlert } from '../lib/alerts.js'

export async function POST(request) {
  const origin = request.headers.get('origin')
  if (origin !== new URL(request.url).origin) return new Response(null, { status: 403 })
  const alreadyNotified = /(?:^|;\s*)sc_visit_alerted=1(?:;|$)/.test(request.headers.get('cookie') || '')
  if (!alreadyNotified) await sendAlert('SkinSafe website opened')
  return new Response(null, {
    status: 204,
    headers: {
      'Cache-Control': 'no-store',
      'Set-Cookie': 'sc_visit_alerted=1; Path=/; Max-Age=86400; SameSite=Lax; Secure; HttpOnly',
    },
  })
}
