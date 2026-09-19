import { dbRun } from '../../utils/db'

const ORG_COOKIE = '__org_id'
const SESSION_COOKIE = '__session'

export default defineEventHandler(async (event) => {
  // Demo sandboxes are throwaway: signing out deletes the org (and every
  // edit made inside it) so the next visitor starts from the seeded state.
  if (event.context.org?.is_demo) {
    await dbRun('DELETE FROM organizations WHERE id = ? AND is_demo = 1', [event.context.org.id])
  }

  deleteCookie(event, SESSION_COOKIE, { path: '/' })
  deleteCookie(event, ORG_COOKIE, { path: '/' })
  return { success: true }
})
