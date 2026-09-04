import type { H3Event } from 'h3'

/**
 * Resolves the current organization for an authenticated request.
 *
 * Priority:
 *   1. `x-organization-id` header (explicit selection, API calls)
 *   2. Custom domain match (highest-priority tenant routing)
 *   3. `{slug}.churchos.my` subdomain
 *   4. Platform host (app.churchos.my / localhost): cookie selection or the
 *      user's first active membership — so a signed-in user always has an
 *      org context even before tenant subdomains are provisioned.
 *
 * Only active memberships are considered.
 */
export default defineEventHandler(async (event) => {
  if (!event.context.user) {
    event.context.org = null
    return
  }

  const host = getRequestHeader(event, 'host') || ''
  const hostname = host.split(':')[0].toLowerCase()
  const orgHeader = getRequestHeader(event, 'x-organization-id')

  let orgId: string | null = null
  let fromPlatformFallback = false

  if (orgHeader) {
    orgId = orgHeader
  } else {
    const admin = useSupabaseAdmin()

    const { data: orgByDomain } = await admin
      .from('organizations')
      .select('id')
      .eq('custom_domain', hostname)
      .eq('custom_domain_verified', true)
      .single()

    if (orgByDomain) {
      orgId = orgByDomain.id
    } else {
      const labels = hostname.split('.')
      const isPlatformHost = labels.length <= 1
        || labels[0] === 'app'
        || labels[0] === 'www'
        || labels[0] === 'localhost'

      if (!isPlatformHost) {
        const { data: orgBySlug } = await admin
          .from('organizations')
          .select('id')
          .eq('slug', labels[0])
          .single()

        if (orgBySlug) orgId = orgBySlug.id
      } else {
        // Platform host: fall back to a stored selection or the first membership.
        fromPlatformFallback = true
      }
    }
  }

  if (fromPlatformFallback && !orgId) {
    const config = useRuntimeConfig()
    const isDemoAccount = event.context.user.email === String(config.public.demoEmail || '')
    const cookieOrgId = getCookie(event, '__org_id')

    if (cookieOrgId) {
      const selected = event.context.user.organizations.find(
        (membership) => membership.organization_id === cookieOrgId && membership.status === 'active'
      )
      orgId = selected?.organization_id ?? null
    } else if (!isDemoAccount) {
      // Non-demo users fall back to their first active membership so a signed-in
      // user always has an org context. The shared demo account must NOT fall
      // back to an arbitrary sandbox — each visitor's sandbox is chosen via the
      // __org_id cookie set by the demo entry flow.
      const memberships = event.context.user.organizations.filter(
        (membership) => membership.status === 'active'
      )
      orgId = memberships[0]?.organization_id ?? null
    }
  }

  if (orgId) {
    const membership = event.context.user.organizations.find(
      (membership) => membership.organization_id === orgId
    )

    if (membership && membership.status === 'active') {
      event.context.org = {
        id: orgId,
        slug: membership.organizations.slug,
        name: membership.organizations.name,
        subscription_status: membership.organizations.subscription_status,
        subscribed_modules: membership.organizations.subscribed_modules,
        subscription_tier: membership.organizations.subscription_tier,
        is_demo: membership.organizations.is_demo,
        userRoles: membership.roles
      }
    } else {
      event.context.org = null
    }
  } else {
    event.context.org = null
  }
})

// Referenced for type inference in event handlers that read event.context.org.
export type OrgContextEvent = H3Event & {
  context: {
    org: {
      id: string
      slug: string
      name: string
      subscription_status: 'inactive' | 'active' | 'suspended' | 'cancelled'
      subscribed_modules: string[]
      subscription_tier: 'starter' | 'growth' | 'pro'
      is_demo: boolean
      userRoles: string[]
    } | null
  }
}