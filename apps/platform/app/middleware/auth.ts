export default defineNuxtRouteMiddleware(async () => {
  try {
    const session = await $fetch<{ authenticated: boolean }>('/api/auth/me')
    if (!session.authenticated) {
      return navigateTo('/auth/login')
    }
  } catch {
    return navigateTo('/auth/login')
  }
})
