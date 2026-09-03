<script setup lang="ts">
definePageMeta({ layout: false })

const route = useRoute()
const loading = ref(true)
const error = ref('')

const sessionId = route.query.session_id

if (!sessionId) {
  error.value = 'No checkout session ID found.'
  loading.value = false
}

onMounted(async () => {
  if (!sessionId) return

  try {
    const result = await $fetch('/api/stripe/verify-session', {
      method: 'GET',
      query: { session_id: sessionId }
    }).catch(() => null)

    if (result) {
      await navigateTo('/dashboard')
    } else {
      error.value = 'Could not verify your checkout session. Please contact support.'
    }
  } catch {
    error.value = 'Something went wrong. Please contact support.'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <main class="auth-page">
    <section class="auth-card" style="text-align:center;">
      <span class="brand-mark" style="margin:0 auto 18px;" aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4">
          <path d="M7 1 L13 13 H1 Z" />
          <line x1="4" y1="8.5" x2="10" y2="8.5" />
        </svg>
      </span>

      <template v-if="loading">
        <p class="display auth-title">Completing your setup…</p>
        <p class="auth-sub">Just a moment while we confirm everything.</p>
      </template>

      <template v-else-if="error">
        <p class="display auth-title" style="color:#fca5a5;">Something went wrong</p>
        <p class="auth-sub">{{ error }}</p>
        <div class="auth-actions" style="margin-top:18px;">
          <NuxtLink to="/auth/login" class="btn btn-primary btn-block">Sign in</NuxtLink>
          <NuxtLink to="https://churchos.my" class="btn btn-ghost btn-block">Back to churchos.my</NuxtLink>
        </div>
      </template>
    </section>
  </main>
</template>
