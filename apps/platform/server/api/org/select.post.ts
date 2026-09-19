import { requireAuth } from '../../utils/auth'

const ORG_COOKIE = '__org_id'
const ORG_COOKIE_MAX_AGE = 60 * 60 * 24 * 365 // 1 year

interface MembershipLike {
  organization_id: string
  status: string
  organizations: {
    id: string
    slug: string
    name: string
  }
}

/**
 * Persists the caller's currently selected organization in an httpOnly cookie.
 * The org-context middleware reads `__org_id` as the platform-host fallback
 * when no tenant subdomain or custom domain is in use.
 */
export default defineEventHandler(async (event) => {
  const user = requireAuth(event)
  const body = await readBody<{ organizationId?: unknown }>(event)
  const organizationId = typeof body?.organizationId === 'string' ? body.organizationId : ''

  if (!organizationId) {
    throw createError({ statusCode: 400, message: 'organizationId required' })
  }

  const memberships = (user.organizations ?? []) as MembershipLike[]
  const membership = memberships.find(
    (candidate: MembershipLike) => candidate.organization_id === organizationId && candidate.status === 'active'
  )

  if (!membership) {
    throw createError({ statusCode: 403, message: 'You are not an active member of this organization' })
  }

  setCookie(event, ORG_COOKIE, organizationId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: ORG_COOKIE_MAX_AGE,
    path: '/'
  })

  return {
    organization: {
      id: membership.organization_id,
      slug: membership.organizations.slug,
      name: membership.organizations.name
    }
  }
})
