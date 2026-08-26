import { createClient, SupabaseClient } from '@supabase/supabase-js'

export function createSupabaseClient(
  supabaseUrl: string,
  supabaseKey: string,
  options?: any
): SupabaseClient {
  return createClient(supabaseUrl, supabaseKey, options)
}

export function createSupabaseAdmin(supabaseUrl: string, serviceKey: string): SupabaseClient {
  return createClient(supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}
