<template>
  <main class="auth-page">
    <section class="auth-card" aria-labelledby="login-title">
      <h1 id="login-title">Sign In</h1>

      <form @submit.prevent="handleLogin">
        <div class="form-group">
          <label for="email">Email</label>
          <input
            id="email"
            v-model="email"
            type="email"
            required
            autocomplete="email"
          >
        </div>

        <div class="form-group">
          <label for="password">Password</label>
          <input
            id="password"
            v-model="password"
            type="password"
            required
            autocomplete="current-password"
          >
        </div>

        <p v-if="error" class="error" role="alert">{{ error }}</p>

        <button type="submit" :disabled="loading">
          {{ loading ? 'Signing in...' : 'Sign In' }}
        </button>
      </form>

      <div class="divider" aria-hidden="true">OR</div>

      <button class="google-btn" :disabled="loading" @click="signInWithGoogle">
        Sign in with Google
      </button>

      <nav class="links" aria-label="Authentication options">
        <NuxtLink to="/auth/signup">Create account</NuxtLink>
        <NuxtLink to="/auth/verify-otp">Sign in with OTP</NuxtLink>
      </nav>
    </section>
  </main>
</template>

<script setup lang="ts">
import { createClient } from '@supabase/supabase-js'

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

async function handleLogin() {
  error.value = ''
  loading.value = true

  try {
    await $fetch('/api/auth/login', {
      method: 'POST',
      body: { email: email.value, password: password.value }
    })

    await navigateTo('/dashboard')
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
    await navigateTo('/dashboard')
  } catch (err: unknown) {
    error.value = errorMessage(err, 'Unable to complete sign-in')
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.auth-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 1rem; background: #f9fafb; }
.auth-card { width: 100%; max-width: 400px; padding: 2rem; background: #fff; border-radius: .5rem; box-shadow: 0 1px 3px rgb(0 0 0 / 10%); }
.form-group { margin-bottom: 1rem; }
label { display: block; margin-bottom: .25rem; font-weight: 500; }
input { box-sizing: border-box; width: 100%; padding: .5rem; border: 1px solid #d1d5db; border-radius: .375rem; }
button { width: 100%; padding: .75rem; color: #fff; font-weight: 500; cursor: pointer; background: #3b82f6; border: 0; border-radius: .375rem; }
button:disabled { cursor: not-allowed; opacity: .5; }
.google-btn { margin-top: .5rem; color: #111827; background: #fff; border: 1px solid #d1d5db; }
.error { margin-bottom: 1rem; color: #dc2626; font-size: .875rem; }
.divider { margin: 1rem 0; color: #6b7280; font-size: .875rem; text-align: center; }
.links { display: flex; justify-content: space-between; gap: 1rem; margin-top: 1.5rem; font-size: .875rem; }
</style>
