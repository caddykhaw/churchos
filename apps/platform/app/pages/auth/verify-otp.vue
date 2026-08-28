<template>
  <main class="auth-page">
    <section class="auth-card" aria-labelledby="otp-title">
      <h1 id="otp-title">Sign in with OTP</h1>

      <form v-if="!otpSent" @submit.prevent="handleRequestOtp">
        <div class="form-group">
          <label for="phone">Phone Number</label>
          <input id="phone" v-model="phone" type="tel" placeholder="+601****6789" required autocomplete="tel">
        </div>

        <button type="submit" :disabled="loading">
          {{ loading ? 'Sending...' : 'Send Code' }}
        </button>
      </form>

      <form v-else @submit.prevent="handleVerifyOtp">
        <p>Enter the code sent to {{ phone }}</p>
        <div class="form-group">
          <label for="otp">6-digit code</label>
          <input id="otp" v-model="otp" inputmode="numeric" maxlength="6" pattern="[0-9]{6}" required autocomplete="one-time-code">
        </div>

        <button type="submit" :disabled="loading">
          {{ loading ? 'Verifying...' : 'Verify' }}
        </button>
      </form>

      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <nav class="links" aria-label="Authentication options">
        <NuxtLink to="/auth/login">Sign in with password</NuxtLink>
      </nav>
    </section>
  </main>
</template>

<script setup lang="ts">
import { createClient } from '@supabase/supabase-js'

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
    await navigateTo('/dashboard')
  } catch (err: unknown) {
    error.value = err instanceof Error ? err.message : 'Invalid OTP'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.auth-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 1rem; background: #f9fafb; }
.auth-card { width: 100%; max-width: 400px; padding: 2rem; background: #fff; border-radius: .5rem; box-shadow: 0 1px 3px rgb(0 0 0 / 10%); }
.form-group { margin-bottom: 1rem; }
label { display: block; margin-bottom: .25rem; font-weight: 500; }
input { box-sizing: border-box; width: 100%; padding: .5rem; border: 1px solid #d1d5db; border-radius: .375rem; }
button { width: 100%; padding: .75rem; color: #fff; font-weight: 500; cursor: pointer; background: #3b82f6; border: 0; border-radius: .375rem; }
button:disabled { cursor: not-allowed; opacity: .5; }
.error { margin-top: 1rem; color: #dc2626; font-size: .875rem; }
.links { margin-top: 1.5rem; font-size: .875rem; }
</style>
