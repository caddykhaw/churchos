import { createClient } from '@supabase/supabase-js'

const SESSION_COOKIE = '__session'
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7

export default defineEventHandler(async (event) => {
  const body = await readBody<{ accessToken?: unknown }>(event)
  const accessToken = typeof body?.accessToken === 'string' ? body.accessToken : ''

  if (!accessToken) {
    throw createError({ statusCode: 400, message: 'Access token required' })
  }

  const config = useRuntimeConfig()
  const supabase = createClient(config.public.supabaseUrl, config.public.supabaseAnonKey)
  const { data, error } = await supabase.auth.getUser(accessToken)

  if (error || !data.user) {
    throw createError({ statusCode: 401, message: 'Invalid session' })
  }

  setCookie(event, SESSION_COOKIE, accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: '/'
  })

  return { success: true }
})
