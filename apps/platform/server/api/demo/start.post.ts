import type { H3Event } from 'h3'
import { getCurrentSandbox, provisionDemoSandbox, signInDemoUser } from '../../utils/demo'

const SESSION_COOKIE = '__session'
const ORG_COOKIE = '__org_id'
const MAX_AGE_SECONDS = 60 * 60 * 8 // demo sandboxes are short-lived

function setDemoCookies(event: H3Event, accessToken: string, orgId: string) {
  setCookie(event, SESSION_COOKIE, accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: MAX_AGE_SECONDS,
    path: '/'
  })

  setCookie(event, ORG_COOKIE, orgId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: MAX_AGE_SECONDS,
    path: '/'
  })
}

/**
 * Enters the ChurchOS demo. If this browser already has a live sandbox (its
 * cookies still point at a demo org), it resumes that sandbox — otherwise a
 * fresh, isolated, seeded copy is provisioned for this visitor.
 */
export default defineEventHandler(async (event) => {
  const existing = await getCurrentSandbox(event)

  if (existing) {
    const accessToken = await signInDemoUser()
    setDemoCookies(event, accessToken, existing.id)
    return { ok: true, organization: { id: existing.id, name: existing.name }, resumed: true }
  }

  const org = await provisionDemoSandbox()
  const accessToken = await signInDemoUser()
  setDemoCookies(event, accessToken, org.id)

  return { ok: true, organization: { id: org.id, name: org.name }, resumed: false }
})