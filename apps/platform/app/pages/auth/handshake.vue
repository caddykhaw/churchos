<template>
  <main class="auth-page">
    <section class="auth-card" aria-label="Completing sign-in">
      <h1 class="display auth-title">Signing you in…</h1>
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
    </section>
  </main>
</template>

<script setup lang="ts">
import type { AuthMeResponse } from '../../composables/useOrg'

definePageMeta({ layout: false })

const error = ref('')
const config = useRuntimeConfig()

onMounted(async () => {
  try {
    await $fetch('/api/auth/set-session', { method: 'POST' })
  } catch {
    error.value = 'Sign-in could not be completed. Please try again.'
    return
  }

  const me = await $fetch<AuthMeResponse>('/api/auth/me').catch(() => null)
  if (me?.organizations?.length) {
    await navigateTo('/dashboard')
  } else if (me?.user?.email === String(config.public.demoEmail || '')) {
    await navigateTo('/auth/demo')
  } else {
    await navigateTo('/organizations/new')
  }
})
</script>
