export default defineEventHandler((event) => {
  if (!event.context.user) {
    return { authenticated: false }
  }

  return {
    authenticated: true,
    user: {
      id: event.context.user.id,
      email: event.context.user.email,
      profile: event.context.user.profile
    },
    organizations: event.context.user.organizations.map((membership: {
      roles: string[]
      organizations: {
        id: string
        slug: string
        name: string
        subscription_status: 'trial' | 'active' | 'suspended' | 'cancelled'
      }
    }) => ({
      id: membership.organizations.id,
      slug: membership.organizations.slug,
      name: membership.organizations.name,
      subscription_status: membership.organizations.subscription_status,
      roles: membership.roles
    })),
    currentOrg: event.context.org
  }
})
