import { createSupabaseAdmin, createSupabaseClient } from '@churchos/database'
import type { H3Event } from 'h3'

let _adminClient: ReturnType<typeof createSupabaseAdmin> | null = null

export function useSupabaseAdmin() {
  if (!_adminClient) {
    const config = useRuntimeConfig()
    _adminClient = createSupabaseAdmin(
      String(config.supabaseUrl),
      String(config.supabaseServiceKey)
    )
  }
  return _adminClient
}

export function useSupabaseForRequest(event: H3Event) {
  const config = useRuntimeConfig()
  const token = getCookie(event, '__session')

  return createSupabaseClient(
    String(config.supabaseUrl),
    String(config.public.supabaseAnonKey), {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    },
    global: {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    }
  })
}
