<template>
  <main class="auth-page">
    <section class="auth-card" aria-labelledby="signup-title">
      <h1 id="signup-title">Create Account</h1>

      <form @submit.prevent="handleSignup">
        <div class="form-group">
          <label for="display-name">Your Name</label>
          <input id="display-name" v-model="displayName" required autocomplete="name">
        </div>

        <div class="form-group">
          <label for="email">Email</label>
          <input id="email" v-model="email" type="email" required autocomplete="email">
        </div>

        <div class="form-group">
          <label for="password">Password (min 8 characters)</label>
          <input id="password" v-model="password" type="password" minlength="8" required autocomplete="new-password">
        </div>

        <p v-if="error" class="error" role="alert">{{ error }}</p>

        <button type="submit" :disabled="loading">
          {{ loading ? 'Creating account...' : 'Create Account' }}
        </button>
      </form>

      <nav class="links" aria-label="Authentication options">
        <NuxtLink to="/auth/login">Already have an account? Sign in</NuxtLink>
      </nav>
    </section>
  </main>
</template>

<script setup lang="ts">
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

async function handleSignup() {
  error.value = ''
  loading.value = true

  try {
    await $fetch('/api/auth/signup', {
      method: 'POST',
      body: { email: email.value, password: password.value, displayName: displayName.value }
    })

    await navigateTo('/onboarding')
  } catch (err: unknown) {
    error.value = errorMessage(err, 'Signup failed')
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
.error { margin-bottom: 1rem; color: #dc2626; font-size: .875rem; }
.links { margin-top: 1.5rem; font-size: .875rem; }
</style>
