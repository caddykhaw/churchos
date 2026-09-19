import { dbOne } from '../../utils/db'
import { signSessionToken, verifyPassword } from '../../utils/session'
import { clientKey, rateLimit } from '../../utils/rate-limit'

const SESSION_COOKIE = '__session'
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7

export default defineEventHandler(async (event) => {
  const body = await readBody<{ email?: unknown, password?: unknown }>(event)
  const email = typeof body?.email === 'string' ? body.email.trim() : ''
  const password = typeof body?.password === 'string' ? body.password : ''

  if (!email || !password) {
    throw createError({ statusCode: 400, message: 'Email and password required' })
  }

  const limit = rateLimit(clientKey(event, 'login'), 10, 15 * 60 * 1000)
  if (!limit.allowed) {
    throw createError({ statusCode: 429, message: 'Too many attempts. Try again later.' })
  }

  // Passwords live in Turso (scrypt hashes) since Clerk owns OAuth/social,
  // while local email+password stays self-contained and database-verifiable.
  const profile = await dbOne('SELECT id FROM profiles WHERE email = ?', [email])
  const credential = profile
    ? await dbOne('SELECT password_hash FROM auth_credentials WHERE profile_id = ?', [profile.id])
    : null

  const valid = credential && typeof credential.password_hash === 'string'
    ? await verifyPassword(password, credential.password_hash)
    : false

  if (!valid) {
    throw createError({ statusCode: 401, message: 'Invalid credentials' })
  }

  setCookie(event, SESSION_COOKIE, signSessionToken({ userId: String(profile!.id) }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: '/'
  })

  return { success: true }
})
