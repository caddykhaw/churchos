export default defineEventHandler(async (event) => {
  if (!event.context.user) {
    event.context.org = null
    return
  }

  const host = getRequestHeader(event, 'host') || ''
  const orgHeader = getRequestHeader(event, 'x-organization-id')

  let orgId: string | null = null

  if (orgHeader) {
    orgId = orgHeader
  } else {
    const admin = useSupabaseAdmin()

    const { data: orgByDomain } = await admin
      .from('organizations')
      .select('id')
      .eq('custom_domain', host)
      .eq('custom_domain_verified', true)
      .single()

    if (orgByDomain) {
      orgId = orgByDomain.id
    } else {
      const subdomain = host.split('.')[0]

      if (subdomain !== 'app' && subdomain !== 'www' && subdomain !== 'localhost') {
        const { data: orgBySlug } = await admin
          .from('organizations')
          .select('id')
          .eq('slug', subdomain)
          .single()

        if (orgBySlug) orgId = orgBySlug.id
      }
    }
  }

  if (orgId) {
    const membership = event.context.user.organizations.find(
      (membership) => membership.organization_id === orgId
    )

    if (membership) {
      event.context.org = {
        id: orgId,
        slug: membership.organizations.slug,
        name: membership.organizations.name,
        subscription_status: membership.organizations.subscription_status,
        subscribed_modules: membership.organizations.subscribed_modules,
        subscription_tier: membership.organizations.subscription_tier,
        trial_ends_at: membership.organizations.trial_ends_at,
        userRoles: membership.roles
      }
    } else {
      event.context.org = null
    }
  } else {
    event.context.org = null
  }
})
