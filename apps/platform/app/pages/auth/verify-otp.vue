<template>
  <main class="auth-page">
    <section class="auth-card" aria-labelledby="otp-title">
      <NuxtLink to="https://churchos.my" class="auth-brand" aria-label="Back to churchos.my">
        <span class="brand-mark" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4">
            <path d="M7 1 L13 13 H1 Z" />
            <line x1="4" y1="8.5" x2="10" y2="8.5" />
          </svg>
        </span>
        ChurchOS
      </NuxtLink>

      <h1 id="otp-title" class="display auth-title">Sign in with OTP</h1>
      <p class="auth-sub">We'll text you a one-time code to verify your number.</p>

      <form v-if="!otpSent" @submit.prevent="handleRequestOtp">
        <div class="field">
          <label class="field-label" for="phone">Phone number</label>
          <input id="phone" v-model="phone" class="input" type="tel" placeholder="+6012 345 6789" required autocomplete="tel">
        </div>

        <div class="auth-actions">
          <button class="btn btn-primary btn-block" type="submit" :disabled="loading">
            {{ loading ? 'Sending…' : 'Send code' }}
          </button>
        </div>
      </form>

      <form v-else @submit.prevent="handleVerifyOtp">
        <p class="auth-sub">Enter the code sent to <strong class="muted">{{ phone }}</strong>.</p>
        <div class="field">
          <label class="field-label" for="otp">6-digit code</label>
          <input id="otp" v-model="otp" class="input" inputmode="numeric" maxlength="6" pattern="[0-9]{6}" required autocomplete="one-time-code">
        </div>

        <div class="auth-actions">
          <button class="btn btn-primary btn-block" type="submit" :disabled="loading">
            {{ loading ? 'Verifying…' : 'Verify' }}
          </button>
        </div>
      </form>

      <p v-if="error" class="form-error" role="alert">{{ error }}</p>

      <nav class="auth-links" aria-label="Authentication options">
        <NuxtLink to="/auth/login">Sign in with password</NuxtLink>
      </nav>
    </section>
  </main>
</template>

<script setup lang="ts">
import { createClient } from '@supabase/supabase-js'
import type { AuthMeResponse } from '../../composables/useOrg'

definePageMeta({ layout: false })

const phone = ref('')
const otp = ref('')
const otpSent = ref(false)
const error = ref('')
const loading = ref(false)
const config = useRuntimeConfig()

function authClient() {
  return createClient(config.public.supabaseUrl, config.public.supabaseAnonKey)
}

async function routeAfterAuth() {
  const me = await $fetch<AuthMeResponse>('/api/auth/me').catch(() => null)
  if (me?.authenticated && me.organizations?.length) {
    await navigateTo('/dashboard')
  } else {
    await navigateTo('/organizations/new')
  }
}

async function handleRequestOtp() {
  error.value = ''
  loading.value = true

  try {
    const { error: authError } = await authClient().auth.signInWithOtp({ phone: phone.value })
    if (authError) {
      throw authError
    }

    otpSent.value = true
  } catch (err: unknown) {
    error.value = err instanceof Error ? err.message : 'Failed to send OTP'
  } finally {
    loading.value = false
  }
}

async function handleVerifyOtp() {
  error.value = ''
  loading.value = true

  try {
    const { data, error: authError } = await authClient().auth.verifyOtp({
      phone: phone.value,
      token: otp.value,
      type: 'sms'
    })
    if (authError) {
      throw authError
    }
    if (!data.session) {
      throw new Error('No session was returned after verification')
    }

    await $fetch('/api/auth/set-session', {
      method: 'POST',
      body: { accessToken: data.session.access_token }
    })
    await routeAfterAuth()
  } catch (err: unknown) {
    error.value = err instanceof Error ? err.message : 'Invalid OTP'
  } finally {
    loading.value = false
  }
}
</script>
