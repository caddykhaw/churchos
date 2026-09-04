import { provisionDemoSandbox, signInDemoUser } from '../../utils/demo'
import { useSupabaseAdmin } from '../../utils/supabase'

const ORG_COOKIE = '__org_id'
const SESSION_COOKIE = '__session'
const MAX_AGE_SECONDS = 60 * 60 * 8

/**
 * Resets the current demo sandbox: deletes the org the visitor is looking at
 * (cascade removes everything they created or changed) and provisions a fresh,
 * cleanly seeded one in its place. Used from the demo banner.
 */
export default defineEventHandler(async (event) => {
  const currentOrgId = getCookie(event, ORG_COOKIE)

  if (currentOrgId) {
    const admin = useSupabaseAdmin()
    // Only delete orgs that are actually demo sandboxes.
    await admin.from('organizations').delete().eq('id', currentOrgId).eq('is_demo', true)
  }

  const org = await provisionDemoSandbox()
  const accessToken = await signInDemoUser()

  setCookie(event, SESSION_COOKIE, accessToken, {
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