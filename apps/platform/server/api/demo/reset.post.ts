import { provisionDemoSandbox, ensureDemoProfile } from '../../utils/demo'
import { signSessionToken } from '../../utils/session'
import { dbRun } from '../../utils/db'
import { clientKey, rateLimit } from '../../utils/rate-limit'

const ORG_COOKIE = '__org_id'
const SESSION_COOKIE = '__session'
const MAX_AGE_SECONDS = 60 * 60 * 8

/**
 * Resets the current demo sandbox: deletes the org the visitor is looking at
 * (cascade removes everything they created or changed) and provisions a fresh,
 * cleanly seeded one in its place. Used from the demo banner.
 */
export default defineEventHandler(async (event) => {
  // Abuse guard: resets delete + reseed a full org.
  const limit = rateLimit(clientKey(event, 'demo-reset'), 20, 60 * 60 * 1000)
  if (!limit.allowed) {
    throw createError({
      statusCode: 429,
      message: `Too many demo resets. Try again in ${limit.retryAfterSeconds} seconds.`
    })
  }

  const currentOrgId = getCookie(event, ORG_COOKIE)

  if (currentOrgId) {
    // Only delete orgs that are actually demo sandboxes.
    await dbRun('DELETE FROM organizations WHERE id = ? AND is_demo = 1', [currentOrgId])
  }

  const org = await provisionDemoSandbox()
  const demoProfileId = await ensureDemoProfile()
  const token = signSessionToken({ userId: demoProfileId, demo: true })

  setCookie(event, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: MAX_AGE_SECONDS,
    path: '/'
  })

  setCookie(event, ORG_COOKIE, org.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: MAX_AGE_SECONDS,
    path: '/'
  })

  return { ok: true, organization: { id: org.id, name: org.name } }
})
