<template>
  <main class="auth-page">
    <section class="auth-card" aria-labelledby="login-title">
      <NuxtLink to="https://churchos.my" class="auth-brand" aria-label="Back to churchos.my">
        <span class="brand-mark" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4">
            <path d="M7 1 L13 13 H1 Z" />
            <line x1="4" y1="8.5" x2="10" y2="8.5" />
          </svg>
        </span>
        ChurchOS
      </NuxtLink>

      <h1 id="login-title" class="display auth-title">Sign in</h1>
      <p class="auth-sub">Welcome back to your church workspace.</p>

      <form @submit.prevent="handleLogin">
        <div class="field">
          <label class="field-label" for="email">Email</label>
          <input id="email" v-model="email" class="input" type="email" required autocomplete="email" placeholder="you@church.example">
        </div>

        <div class="field">
          <label class="field-label" for="password">Password</label>
          <input id="password" v-model="password" class="input" type="password" required autocomplete="current-password" placeholder="Your password">
        </div>

        <p v-if="error" class="form-error" role="alert">{{ error }}</p>

        <div class="auth-actions">
          <button class="btn btn-primary btn-block" type="submit" :disabled="loading">
            {{ loading ? 'Signing in…' : 'Sign in' }}
          </button>
        </div>
      </form>

      <div class="auth-divider" aria-hidden="true">Or</div>

      <div class="auth-actions">
        <button class="btn btn-ghost btn-block" :disabled="loading" @click="signInWithGoogle">
          Sign in with Google
        </button>
      </div>

      <nav class="auth-links" aria-label="Authentication options">
        <NuxtLink to="/auth/signup">Create account</NuxtLink>
        <NuxtLink to="/auth/demo">Try the demo</NuxtLink>
      </nav>
    </section>
  </main>
</template>

<script setup lang="ts">
import { createClient } from '@supabase/supabase-js'
import type { AuthMeResponse } from '../../composables/useOrg'

definePageMeta({ layout: false })

const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)
const config = useRuntimeConfig()

function errorMessage(err: unknown, fallback: string) {
  if (err && typeof err === 'object' && 'data' in err) {
    const data = err.data
    if (data && typeof data === 'object' && 'message' in data && typeof data.message === 'string') {
      return data.message
    }
  }
  return fallback
}

async function setSession(accessToken: string) {
  await $fetch('/api/auth/set-session', {
    method: 'POST',
    body: { accessToken }
  })
}

async function routeAfterAuth() {
  const config = useRuntimeConfig()
  const me = await $fetch<AuthMeResponse>('/api/auth/me').catch(() => null)
  if (!me?.authenticated) {
    return
  }
  if (me.organizations?.length) {
    await navigateTo('/dashboard')
  } else if (me.user?.email === String(config.public.demoEmail || '')) {
    // Demo account without a live sandbox: back to the demo entry.
    await navigateTo('/auth/demo')
  } else {
    await navigateTo('/organizations/new')
  }
}

async function handleLogin() {
  error.value = ''
  loading.value = true

  try {
    await $fetch('/api/auth/login', {
      method: 'POST',
      body: { email: email.value, password: password.value }
    })

    await routeAfterAuth()
  } catch (err: unknown) {
    error.value = errorMessage(err, 'Login failed')
  } finally {
    loading.value = false
  }
}

async function signInWithGoogle() {
  error.value = ''
  loading.value = true

  try {
    const supabase = createClient(config.public.supabaseUrl, config.public.supabaseAnonKey)
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/login` }
    })

    if (authError) {
      throw authError
    }
  } catch (err: unknown) {
    error.value = err instanceof Error ? err.message : 'Google sign-in failed'
    loading.value = false
  }
}

onMounted(async () => {
  const supabase = createClient(config.public.supabaseUrl, config.public.supabaseAnonKey)
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    return
  }

  loading.value = true
  try {
    await setSession(session.access_token)
    await routeAfterAuth()
  } catch (err: unknown) {
    error.value = errorMessage(err, 'Unable to complete sign-in')
  } finally {
    loading.value = false
  }
})
</script>
