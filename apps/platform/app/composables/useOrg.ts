export interface OrganizationSummary {
  id: string
  slug: string
  name: string
  subscription_status: 'trial' | 'active' | 'suspended' | 'cancelled'
  subscribed_modules?: string[]
  subscription_tier?: 'starter' | 'growth' | 'pro'
  trial_ends_at?: string | null
  roles?: string[]
}

interface AuthMeResponse {
  authenticated: boolean
  organizations: OrganizationSummary[]
  currentOrg: OrganizationSummary | null
}

export function useOrg() {
  const currentOrg = useState<OrganizationSummary | null>('currentOrg', () => null)
  const userOrgs = useState<OrganizationSummary[]>('userOrgs', () => [])

  async function loadUserOrgs() {
    const data = await $fetch<AuthMeResponse>('/api/auth/me')

    if (data.authenticated) {
      userOrgs.value = data.organizations || []
      currentOrg.value = data.currentOrg
    } else {
      userOrgs.value = []
      currentOrg.value = null
    }
  }

  function switchOrg(orgSlug: string) {
    if (!import.meta.client) return

    const { protocol, host } = window.location
    if (host.includes('localhost')) {
      window.location.assign(`${protocol}//${host}/_org/${orgSlug}`)
      return
    }

    const rootDomain = host.includes('staging')
      ? 'staging.churchos.my'
      : 'churchos.my'
    window.location.assign(`${protocol}//${orgSlug}.${rootDomain}`)
  }

  return {
    currentOrg: readonly(currentOrg),
    userOrgs: readonly(userOrgs),
    loadUserOrgs,
    switchOrg,
  }
}
