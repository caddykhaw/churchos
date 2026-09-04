export default defineEventHandler((event) => {
  if (!event.context.user) {
    return { authenticated: false }
  }

  interface MembershipSummary {
    id: string
    slug: string
    name: string
    subscription_status: 'inactive' | 'active' | 'suspended' | 'cancelled'
    is_demo: boolean
    roles: string[]
  }

  const memberships = event.context.user.organizations.map((membership: {
    roles: string[]
    organizations: {
      id: string
      slug: string
      name: string
      subscription_status: 'inactive' | 'active' | 'suspended' | 'cancelled'
      is_demo: boolean
    }
  }) => ({
    id: membership.organizations.id,
    slug: membership.organizations.slug,
    name: membership.organizations.name,
    subscription_status: membership.organizations.subscription_status,
    is_demo: membership.organizations.is_demo,
    roles: membership.roles
  }))

  // The demo account is shared: every visitor provisions their own sandbox
  // org under the same auth user. Expose only the org this session is pointed
  // at (via __org_id) so visitors can't see or hop into each other's sandboxes.
  const currentOrg = event.context.org
  const visibleOrganizations = currentOrg?.is_demo
    ? memberships.filter((membership: MembershipSummary) => membership.id === currentOrg.id)
    : memberships

  return {
    authenticated: true,
    user: {
      id: event.context.user.id,
      email: event.context.user.email,
      profile: event.context.user.profile
    },
    organizations: visibleOrganizations,
    currentOrg
  }
})