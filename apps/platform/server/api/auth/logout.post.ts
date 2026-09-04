import { useSupabaseAdmin } from '../../utils/supabase'

const ORG_COOKIE = '__org_id'
const SESSION_COOKIE = '__session'

export default defineEventHandler(async (event) => {
  // Demo sandboxes are throwaway: signing out deletes the org (and every
  // edit made inside it) so the next visitor starts from the seeded state.
  if (event.context.org?.is_demo) {
    const admin = useSupabaseAdmin()
    await admin.from('organizations').delete().eq('id', event.context.org.id).eq('is_demo', true)
  }

  deleteCookie(event, SESSION_COOKIE, { path: '/' })
  deleteCookie(event, ORG_COOKIE, { path: '/' })
  return { success: true }
})