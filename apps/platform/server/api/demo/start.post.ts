import type { H3Event } from 'h3'
import { getCurrentSandbox, provisionDemoSandbox, ensureDemoProfile } from '../../utils/demo'
import { signSessionToken } from '../../utils/session'
import { clientKey, rateLimit } from '../../utils/rate-limit'

const SESSION_COOKIE = '__session'
const ORG_COOKIE = '__org_id'
const MAX_AGE_SECONDS = 60 * 60 * 8 // demo sandboxes are short-lived

function setDemoCookies(event: H3Event, token: string, orgId: string) {
  setCookie(event, SESSION_COOKIE, token, {
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
 *
 * Auth: visitors are anonymous. We mint a first-party signed session bound to
 * the shared demo profile (Clerk is not involved; the demo profile exists only
 * in Turso).
 */
export default defineEventHandler(async (event) => {
  // Abuse guard: each fresh sandbox provisions a full org + seed data, so
  // cap unauthenticated provisioning per IP. Resuming an existing sandbox is
  // free — the limit only applies to new sandbox creation.
  const existingSandbox = await getCurrentSandbox(event)
  if (!existingSandbox) {
    const limit = rateLimit(clientKey(event, 'demo-start'), 10, 24 * 60 * 60 * 1000)
    if (!limit.allowed) {
      throw createError({
        statusCode: 429,
        message: `Too many demo workspaces created. Try again in ${limit.retryAfterSeconds} seconds.`
      })
    }
  }

  const existing = existingSandbox

  if (existing) {
    const demoProfileId = await ensureDemoProfile()
    setDemoCookies(event, signSessionToken({ userId: demoProfileId, demo: true }), existing.id as string)
    return { ok: true, organization: { id: existing.id, name: existing.name }, resumed: true }
  }

  const org = await provisionDemoSandbox()
  const demoProfileId = await ensureDemoProfile()
  setDemoCookies(event, signSessionToken({ userId: demoProfileId, demo: true }), org.id)

  return { ok: true, organization: { id: org.id, name: org.name }, resumed: false }
})
