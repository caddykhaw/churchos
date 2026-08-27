import { createClient } from '@supabase/supabase-js'

const SESSION_COOKIE = '__session'
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7

export default defineEventHandler(async (event) => {
  const body = await readBody<{ email?: unknown, password?: unknown }>(event)
  const email = typeof body?.email === 'string' ? body.email.trim() : ''
  const password = typeof body?.password === 'string' ? body.password : ''

  if (!email || !password) {
    throw createError({ statusCode: 400, message: 'Email and password required' })
  }

  const config = useRuntimeConfig()
  const supabase = createClient(config.public.supabaseUrl, config.public.supabaseAnonKey)
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error || !data.session) {
    throw createError({ statusCode: 401, message: 'Invalid credentials' })
  }

  setCookie(event, SESSION_COOKIE, data.session.access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: '/'
  })

  return { success: true }
})
