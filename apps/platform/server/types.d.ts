import type { Organization, Profile } from '@churchos/database'

declare module 'h3' {
  interface H3EventContext {
    user: {
      id: string
      email: string
      profile: Profile
      organizations: Array<{
        organization_id: string
        roles: string[]
        status: string
        organizations: Pick<Organization, 'id' | 'slug' | 'name' | 'subscription_status' | 'subscribed_modules' | 'subscription_tier' | 'is_demo'>
      }>
    } | null

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

export {}
