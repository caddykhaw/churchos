import { parseJsonArray } from '@churchos/database'
import { verifySessionToken } from '../utils/session'
import { dbAll, dbOne } from '../utils/db'

const SESSION_COOKIE = '__session'

/**
 * Resolves the authenticated user for this request.
 *
 * Auth now flows through Clerk: the Clerk module populates `event.context.auth`
 * with `{ userId }` for every request. That userId is mapped to a local
 * `profiles` row (created lazily on first sign-in) and the memberships are
 * loaded from Turso.
 */
export default defineEventHandler(async (event) => {
  event.context.user = null
  event.context.org = null

  const { userId: clerkUserId } = event.context.auth ?? {}
  if (!clerkUserId) return

  // Map the Clerk identity to a local profile (JIT provisioning keeps signup
  // flows serverless — Clerk owns credentials, Turso owns app data).
  let profile = await dbOne('SELECT * FROM profiles WHERE id = ?', [clerkUserId])

  if (!profile) {
    try {
      const { clerkClient } = await import('@clerk/nuxt/server')
      const client = clerkClient(event)
      const clerkUser = await client.users.getUser(clerkUserId)
      const email = clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)?.emailAddress
        || clerkUser.emailAddresses[0]?.emailAddress
        || `${clerkUserId}@clerk.placeholder`
      await dbRun(
        `INSERT INTO profiles (id, email, display_name) VALUES (?, ?, ?)
         ON CONFLICT(id) DO NOTHING`,
        [clerkUserId, email, clerkUser.firstName || null]
      )
      profile = await dbOne('SELECT * FROM profiles WHERE id = ?', [clerkUserId])
    } catch (err) {
      console.error('Profile provisioning failed:', err)
      return
    }
  }

  const memberships = await dbAll(
    `SELECT om.organization_id, om.roles, om.status,
            o.id AS org_id, o.slug, o.name, o.subscription_status, o.trial_ends_at,
            o.subscribed_modules, o.subscription_tier, o.is_demo
       FROM organization_members om
       JOIN organizations o ON o.id = om.organization_id
      WHERE om.user_id = ? AND om.status = 'active'`,
    [clerkUserId]
  )

  event.context.user = {
    id: clerkUserId,
    email: String(profile?.email || clerkUserId),
    profile,
    organizations: memberships.map((row) => ({
      organization_id: String(row.organization_id),
      roles: parseJsonArray(row.roles),
      status: String(row.status),
      organizations: {
        id: String(row.org_id),
        slug: String(row.slug),
        name: String(row.name),
        subscription_status: row.subscription_status as 'inactive' | 'active' | 'suspended' | 'cancelled',
        trial_ends_at: (row.trial_ends_at as string | null) ?? null,
        subscribed_modules: parseJsonArray(row.subscribed_modules),
        subscription_tier: row.subscription_tier as 'starter' | 'growth' | 'pro',
        is_demo: Number(row.is_demo) === 1
      }
    }))
  }
})

export { SESSION_COOKIE, verifySessionToken }
