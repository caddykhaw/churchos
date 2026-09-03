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

export interface AuthMeResponse {
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
      currentOrg.value = data.currentOrg || userOrgs.value[0] || null
    } else {
      userOrgs.value = []
      currentOrg.value = null
    }
  }

  /** Persists the selected org (cookie) and returns to the dashboard. */
  async function selectOrg(orgId: string) {
    await $fetch('/api/org/select', {
      method: 'POST',
      body: { organizationId: orgId }
    })
    currentOrg.value = userOrgs.value.find((org) => org.id === orgId) ?? null
  }

  return {
    currentOrg: readonly(currentOrg),
    userOrgs: readonly(userOrgs),
    loadUserOrgs,
    selectOrg,
  }
}
