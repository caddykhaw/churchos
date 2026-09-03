<template>
  <main class="auth-page">
    <section class="auth-card" aria-labelledby="signup-title">
      <NuxtLink to="https://churchos.my" class="auth-brand" aria-label="Back to churchos.my">
        <span class="brand-mark" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4">
            <path d="M7 1 L13 13 H1 Z" />
            <line x1="4" y1="8.5" x2="10" y2="8.5" />
          </svg>
        </span>
        ChurchOS
      </NuxtLink>

      <h1 id="signup-title" class="display auth-title">Start your 14-day trial</h1>
      <p class="auth-sub">
        Create your account — no credit card required. Next you'll set up your
        church workspace.
      </p>

      <form @submit.prevent="handleSignup">
        <div class="field">
          <label class="field-label" for="display-name">Your name</label>
          <input id="display-name" v-model="displayName" class="input" required autocomplete="name" placeholder="Pastor John Tan">
        </div>

        <div class="field">
          <label class="field-label" for="email">Email</label>
          <input id="email" v-model="email" class="input" type="email" required autocomplete="email" placeholder="you@church.example">
        </div>

        <div class="field">
          <label class="field-label" for="password">Password</label>
          <input id="password" v-model="password" class="input" type="password" minlength="8" required autocomplete="new-password" placeholder="At least 8 characters">
        </div>

        <p v-if="error" class="form-error" role="alert">{{ error }}</p>

        <div class="auth-actions">
          <button class="btn btn-primary btn-block" type="submit" :disabled="loading">
            {{ loading ? 'Creating account…' : 'Create account' }}
          </button>
        </div>
      </form>

      <nav class="auth-links" aria-label="Authentication options">
        <NuxtLink to="/auth/login">Already have an account? Sign in</NuxtLink>
      </nav>
    </section>
  </main>
</template>

<script setup lang="ts">
import type { AuthMeResponse } from '../../composables/useOrg'

definePageMeta({ layout: false })

const displayName = ref('')
const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

function errorMessage(err: unknown, fallback: string) {
  if (err && typeof err === 'object' && 'data' in err) {
    const data = err.data
    if (data && typeof data === 'object' && 'message' in data && typeof data.message === 'string') {
      return data.message
    }
  }
  return fallback
}

async function routeAfterAuth() {
  const me = await $fetch<AuthMeResponse>('/api/auth/me').catch(() => null)
  if (me?.authenticated && me.organizations?.length) {
    await navigateTo('/dashboard')
  } else {
    // Fresh trial accounts have no church yet — send them to the setup step.
    await navigateTo('/organizations/new')
  }
}

async function handleSignup() {
  error.value = ''
  loading.value = true
  try {
    await $fetch('/api/auth/signup', {
      method: 'POST',
      body: {
        email: email.value,
        password: password.value,
        displayName: displayName.value
      }
    })

    await routeAfterAuth()
  } catch (err: unknown) {
    error.value = errorMessage(err, 'Signup failed')
  } finally {
    loading.value = false
  }
}
</script>
