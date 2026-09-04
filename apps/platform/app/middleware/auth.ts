import type { AuthMeResponse, OrganizationSummary } from '../composables/useOrg'

export default defineNuxtRouteMiddleware(async (to) => {
  // Forward the request's cookies on the server so SSR sees the real session;
  // on the client a plain $fetch already carries the cookie jar.
  const apiFetch = import.meta.server ? useRequestFetch() : $fetch
  const me = await apiFetch<AuthMeResponse>('/api/auth/me').catch(() => null)

  if (!me?.authenticated) {
    return navigateTo('/auth/login')
  }

  // Hydrate shared org state so layouts/pages render server-side data.
  const currentOrg = useState<OrganizationSummary | null>('currentOrg', () => null)
  const userOrgs = useState<OrganizationSummary[]>('userOrgs', () => [])
  const currentUserEmail = useState<string | null>('currentUserEmail', () => null)

  if (me.currentOrg) {
    currentOrg.value = me.currentOrg
  }
  if (me.organizations?.length) {
    userOrgs.value = me.organizations
  }
  currentUserEmail.value = me.user?.email || null

  const config = useRuntimeConfig()
  const isDemoAccount = Boolean(me.user?.email) && me.user!.email === String(config.public.demoEmail || '')

  if (isDemoAccount) {
    // Demo sessions enter through the demo flow, which provisions a sandbox.
    if (!userOrgs.value.length) {
      return navigateTo('/auth/demo')
    }
  } else if (!userOrgs.value.length && to.path !== '/organizations/new') {
    // A brand-new account must set up its church workspace first.
    return navigateTo('/organizations/new')
  }

  // No explicit org context (direct app.churchos.my visit): default to the first org.
  if (!currentOrg.value && userOrgs.value.length) {
    currentOrg.value = userOrgs.value[0] ?? null
  }
})