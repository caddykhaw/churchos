import type { Organization, OrganizationMember } from '@churchos/database'
import { requireAuth } from '../../utils/auth'
import { useSupabaseAdmin } from '../../utils/supabase'

type Membership = OrganizationMember & { organizations: Pick<Organization, 'id' | 'slug' | 'name' | 'subscription_status' | 'subscribed_modules' | 'subscription_tier' | 'trial_ends_at'> }

/**
 * Returns the full organizations row for the caller's current org context.
 * Falls back to the caller's first active membership when no context is set
 * (e.g. direct navigation on app.churchos.my).
 */
export default defineEventHandler(async (event) => {
  const user = requireAuth(event)
  const contextOrg = event.context.org

  const memberships = (user.organizations ?? []) as Membership[]
  const orgId = contextOrg?.id
    ?? memberships.find((membership) => membership.status === 'active')?.organization_id

  if (!orgId) {
    throw createError({ statusCode: 400, message: 'No organization found for this account' })
  }

  const admin = useSupabaseAdmin()
  const { data: org, error } = await admin
    .from('organizations')
    .select('*')
    .eq('id', orgId)
    .maybeSingle()

  if (error || !org) {
    throw createError({ statusCode: 404, message: 'Organization not found' })
  }

  return org
})
