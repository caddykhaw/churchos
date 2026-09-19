import { clerkClient } from '@clerk/nuxt/server'
import { dbRun, dbOne } from '../../utils/db'
import { signSessionToken } from '../../utils/session'

const SESSION_COOKIE = '__session'
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7

export default defineEventHandler(async (event) => {
  const body = await readBody<{ email?: unknown, password?: unknown, displayName?: unknown }>(event)
  const email = typeof body?.email === 'string' ? body.email.trim() : ''
  const password = typeof body?.password === 'string' ? body.password : ''
  const displayName = typeof body?.displayName === 'string' && body.displayName.trim()
    ? body.displayName.trim()
    : email.split('@')[0]

  if (!email || !password) {
    throw createError({ statusCode: 400, message: 'Email and password required' })
  }

  if (password.length < 8) {
    throw createError({ statusCode: 400, message: 'Password must be at least 8 characters' })
  }

  const config = useRuntimeConfig()
  if (email.toLowerCase() === String(config.public.demoEmail || '').toLowerCase()) {
    throw createError({ statusCode: 400, message: 'This email is reserved' })
  }

  // Credentials are owned by Clerk; the local profile row is created here.
  // Note: Clerk will surface its own validation errors (invalid email, etc.).
  let clerkUser
  try {
    clerkUser = await clerkClient(event).users.createUser({
      emailAddress: [email],
      password,
      firstName: displayName,
      skipPasswordChecks: false
    })
  } catch (err: unknown) {
    const message = err instanceof Error && 'message' in err ? err.message : ''
    throw createError({ statusCode: 400, message: message || 'Failed to create user' })
  }

  await dbRun(
    `INSERT INTO profiles (id, email, display_name) VALUES (?, ?, ?)
     ON CONFLICT(id) DO NOTHING`,
    [clerkUser.id, email, displayName]
  )

  const profile = await dbOne('SELECT id FROM profiles WHERE id = ?', [clerkUser.id])
  if (!profile) {
    throw createError({ statusCode: 500, message: 'Failed to create user profile' })
  }

  setCookie(event, SESSION_COOKIE, signSessionToken({ userId: clerkUser.id }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: '/'
  })

  return { user: { id: clerkUser.id, email } }
})
