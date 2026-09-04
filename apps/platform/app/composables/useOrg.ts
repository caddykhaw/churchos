export interface OrganizationSummary {
  id: string
  slug: string
  name: string
  subscription_status: 'inactive' | 'active' | 'suspended' | 'cancelled'
  is_demo?: boolean
  subscribed_modules?: string[]
  subscription_tier?: 'starter' | 'growth' | 'pro'
  roles?: string[]
}

export interface AuthMeResponse {
  authenticated: boolean
  user?: {
    id: string
    email: string
  }
  organizations: OrganizationSummary[]
  currentOrg: OrganizationSummary | null
}

export function useOrg() {
  const currentOrg = useState<OrganizationSummary | null>('currentOrg', () => null)
  const userOrgs = useState<OrganizationSummary[]>('userOrgs', () => [])
  const currentUserEmail = useState<string | null>('currentUserEmail', () => null)

  async function loadUserOrgs() {
    const data = await $fetch<AuthMeResponse>('/api/auth/me')

    if (data.authenticated) {
      userOrgs.value = data.organizations || []
      currentOrg.value = data.currentOrg || userOrgs.value[0] || null
      currentUserEmail.value = data.user?.email || null
    } else {
      userOrgs.value = []
      currentOrg.value = null
      currentUserEmail.value = null
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
    currentUserEmail: readonly(currentUserEmail),
    loadUserOrgs,
    selectOrg,
  }
}

/**
 * Demo role lens. The demo sandbox grants every role; the visitor picks which
 * role's view they want to preview. This is a UI-only cookie — it never
 * re-authenticates, so sandbox edits survive role switching.
 */
export type DemoRole = 'admin' | 'member' | 'mentor' | 'volunteer'

export const DEMO_ROLES: DemoRole[] = ['admin', 'member', 'mentor', 'volunteer']

export function useDemoRole() {
  const role = useCookie<DemoRole>('__demo_role', { default: () => 'admin' })
  return { demoRole: role }
}