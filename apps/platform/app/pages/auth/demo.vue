<template>
  <main class="auth-page">
    <section class="auth-card" style="max-width: 460px;" aria-labelledby="demo-title">
      <NuxtLink to="https://churchos.my" class="auth-brand" aria-label="Back to churchos.my">
        <span class="brand-mark" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4">
            <path d="M7 1 L13 13 H1 Z" />
            <line x1="4" y1="8.5" x2="10" y2="8.5" />
          </svg>
        </span>
        ChurchOS Demo
      </NuxtLink>

      <h1 id="demo-title" class="display auth-title">Try the ChurchOS demo</h1>
      <p class="auth-sub">
        A fully working church workspace pre-loaded with sample data. Add
        members, build tracks, edit pages — everything is editable. When you
        sign out, your copy resets for the next visitor.
      </p>

      <div v-if="error" class="form-error" role="alert">{{ error }}</div>

      <div class="demo-creds" role="group" aria-label="Demo credentials">
        <div class="demo-creds__row">
          <span class="demo-creds__label">Email</span>
          <code class="demo-creds__value">{{ config.public.demoEmail }}</code>
        </div>
        <div class="demo-creds__row">
          <span class="demo-creds__label">Password</span>
          <code class="demo-creds__value">{{ config.public.demoPassword }}</code>
        </div>
      </div>

      <div class="auth-actions">
        <button class="btn btn-primary btn-block" :disabled="loading" @click="enterDemo">
          {{ loading ? 'Preparing your sandbox…' : 'Open the demo →' }}
        </button>
      </div>

      <p class="field-hint" style="text-align:center; margin-top: 12px;">
        Works like the real thing — your changes just don't outlive the session.
      </p>

      <nav class="auth-links" aria-label="Authentication options">
        <NuxtLink to="/auth/login">Sign in to a real workspace</NuxtLink>
        <NuxtLink to="https://churchos.my">Back to churchos.my</NuxtLink>
      </nav>
    </section>
  </main>
</template>

<script setup lang="ts">
definePageMeta({ layout: false })

const config = useRuntimeConfig()
const loading = ref(false)
const error = ref('')

function errorMessage(err: unknown, fallback: string) {
  if (err && typeof err === 'object' && 'data' in err) {
    const data = err.data
    if (data && typeof data === 'object' && 'message' in data && typeof data.message === 'string') {
      return data.message
    }
  }
  return fallback
}

async function enterDemo() {
  error.value = ''
  loading.value = true
  try {
    await $fetch('/api/demo/start', { method: 'POST' })
    await navigateTo('/dashboard')
  } catch (err: unknown) {
    error.value = errorMessage(err, 'Could not start the demo — please try again.')
  } finally {
    loading.value = false
  }
}
</script>