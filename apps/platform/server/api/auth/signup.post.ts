import { createClient } from '@supabase/supabase-js'
import { useSupabaseAdmin } from '../../utils/supabase'

const SESSION_COOKIE = '__session'
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7

function setSessionCookie(event: Parameters<typeof setCookie>[0], accessToken: string) {
  setCookie(event, SESSION_COOKIE, accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: '/'
  })
}

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

  const admin = useSupabaseAdmin()
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName }
  })

  if (authError || !authData.user) {
    throw createError({ statusCode: 400, message: authError?.message || 'Failed to create user' })
  }

  const { error: profileError } = await admin
    .from('profiles')
    .insert({ id: authData.user.id, email, display_name: displayName, preferred_language: 'en' })

  if (profileError) {
    throw createError({ statusCode: 500, message: 'Failed to create user profile' })
  }

  const config = useRuntimeConfig()
  const supabase = createClient(config.public.supabaseUrl, config.public.supabaseAnonKey)
  const { data: sessionData, error: signInError } = await supabase.auth.signInWithPassword({ email, password })

  if (signInError || !sessionData.session) {
    throw createError({ statusCode: 500, message: 'User created but sign-in failed' })
  }

  setSessionCookie(event, sessionData.session.access_token)

  return { user: { id: authData.user.id, email } }
})
