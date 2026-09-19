import { dbOne, dbRun } from '../../utils/db'
import { signSessionToken } from '../../utils/session'

const SESSION_COOKIE = '__session'
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7

/**
 * Mints a first-party session cookie for an authenticated Clerk user.
 * Called by client flows that authenticate through Clerk components (sign-in,
 * sign-up, OTP) and need the platform APIs to recognize the session.
 *
 * Rejects cross-origin requests so a site holding its own valid Clerk token
 * cannot force a visitor into that account (login CSRF/session fixation).
 */
export default defineEventHandler(async (event) => {
  const origin = getRequestHeader(event, 'origin')
  if (!origin || origin !== getRequestURL(event).origin) {
    throw createError({ statusCode: 403, message: 'Invalid request origin' })
  }

  const { userId: clerkUserId } = event.context.auth ?? {}
  if (!clerkUserId) {
    throw createError({ statusCode: 401, message: 'Invalid session' })
  }

  // Ensure the local profile row exists for this Clerk identity.
  const profile = await dbOne('SELECT id FROM profiles WHERE id = ?', [clerkUserId])
  if (!profile) {
    try {
      const { clerkClient } = await import('@clerk/nuxt/server')
      const clerkUser = await clerkClient(event).users.getUser(clerkUserId)
      const email = clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)?.emailAddress
        || clerkUser.emailAddresses[0]?.emailAddress
        || `${clerkUserId}@clerk.placeholder`
      await dbRun(
        `INSERT INTO profiles (id, email, display_name) VALUES (?, ?, ?)
         ON CONFLICT(id) DO NOTHING`,
        [clerkUserId, email, clerkUser.firstName || null]
      )
    } catch {
      throw createError({ statusCode: 401, message: 'Invalid session' })
    }
  }

  setCookie(event, SESSION_COOKIE, signSessionToken({ userId: clerkUserId }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: '/'
  })

  return { success: true }
})
