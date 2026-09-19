import { parseJsonArray } from '@churchos/database'
import { requireAuth } from '../../utils/auth'
import { dbOne } from '../../utils/db'

interface MembershipLike {
  organization_id: string
  status: string
}

/**
 * Returns the full organizations row for the caller's current org context.
 * Falls back to the caller's first active membership when no context is set
 * (e.g. direct navigation on app.churchos.my).
 */
export default defineEventHandler(async (event) => {
  const user = requireAuth(event)
  const contextOrg = event.context.org

  const memberships = (user.organizations ?? []) as MembershipLike[]
  const orgId = contextOrg?.id
    ?? memberships.find((membership: MembershipLike) => membership.status === 'active')?.organization_id

  if (!orgId) {
    throw createError({ statusCode: 400, message: 'No organization found for this account' })
  }

  const org = await dbOne('SELECT * FROM organizations WHERE id = ?', [orgId])

  if (!org) {
    throw createError({ statusCode: 404, message: 'Organization not found' })
  }

  return {
    ...org,
    subscribed_modules: parseJsonArray(org.subscribed_modules),
    is_demo: Number(org.is_demo) === 1
  }
})
