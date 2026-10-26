import { createClerkClient } from '@clerk/backend'
import { hasSession } from './judge-session.js'

export async function hasAppSession(request) {
  if (hasSession(request, process.env.GROQ_API_KEY)) return true
  const publishableKey = process.env.CLERK_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
  if (!process.env.CLERK_SECRET_KEY || !publishableKey) return false
  try {
    const client = createClerkClient({
      secretKey: process.env.CLERK_SECRET_KEY,
      publishableKey,
    })
    const state = await client.authenticateRequest(request, {
      authorizedParties: [new URL(request.url).origin],
    })
    return state.isAuthenticated
  } catch {
    return false
  }
}
