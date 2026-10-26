const agentMailBase = 'https://api.agentmail.to/v0'

async function agentMail(path, body) {
  const response = await fetch(`${agentMailBase}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.AGENTMAIL_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
  })
  if (!response.ok) throw new Error(`AgentMail request failed (${response.status})`)
  return response.json()
}

export async function sendAlert(subject) {
  if (!process.env.AGENTMAIL_API_KEY || !process.env.SKINSAFE_ALERT_EMAIL) return false
  try {
    const inbox = await agentMail('/inboxes', {
      client_id: 'skinsafe-site-alerts-v1',
      display_name: 'SkinSafe Alerts',
    })
    await agentMail(`/inboxes/${encodeURIComponent(inbox.inbox_id)}/messages/send`, {
      to: [process.env.SKINSAFE_ALERT_EMAIL.trim()],
      subject,
      text: `${subject}\n${new Date().toISOString()}`,
    })
    return true
  } catch (error) {
    console.error('SkinSafe alert could not be sent:', error instanceof Error ? error.message : 'unknown error')
    return false
  }
}
