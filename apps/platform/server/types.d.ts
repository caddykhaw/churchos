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
        organizations: Pick<Organization, 'id' | 'slug' | 'name' | 'subscription_status' | 'subscribed_modules' | 'subscription_tier' | 'trial_ends_at'>
      }>
    } | null

    org: {
      id: string
      slug: string
      name: string
      subscription_status: 'trial' | 'active' | 'suspended' | 'cancelled'
      subscribed_modules: string[]
      subscription_tier: 'starter' | 'growth' | 'pro'
      trial_ends_at: string | null
      userRoles: string[]
    } | null
  }
}

export {}
