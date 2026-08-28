<template>
  <main class="auth-page">
    <section class="auth-card" aria-labelledby="signup-title">
      <h1 id="signup-title">Create Your Account</h1>
      <p class="subtitle">You've completed payment. Now let's set up your ChurchOS account.</p>

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
          {{ loading ? 'Creating account...' : 'Create Account & Launch' }}
        </button>
      </form>

      <nav class="links" aria-label="Authentication options">
        <NuxtLink to="/auth/login">Already have an account? Sign in</NuxtLink>
      </nav>
    </section>
  </main>
</template>

<script setup lang="ts">
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
    // Create auth user on the platform — the org was already created by the Stripe webhook
    await $fetch('/api/auth/signup', {
      method: 'POST',
      body: {
        email: email.value,
        password: password.value,
        displayName: displayName.value
      }
    })

    // Link user to their pre-created org
    await $fetch('/api/org/join-org', {
      method: 'POST',
      body: { email: email.value }
    }).catch(() => {}) // May already be a member

    await navigateTo('/')
  } catch (err: unknown) {
    error.value = errorMessage(err, 'Signup failed')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.auth-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 1rem; background: #171717; }
.auth-card { width: 100%; max-width: 400px; padding: 2rem; background: #2a2a2a; border-radius: .5rem; border: 1px solid #3a3a3a; }
.subtitle { color: #9ca3af; font-size: .875rem; margin-bottom: 1.5rem; text-align: center; }
.form-group { margin-bottom: 1rem; }
label { display: block; margin-bottom: .25rem; font-weight: 500; color: #d1d5db; }
input { box-sizing: border-box; width: 100%; padding: .5rem; border: 1px solid #3a3a3a; border-radius: .375rem; background: #1a1a1a; color: #f9fafb; }
button { width: 100%; padding: .75rem; color: #171717; font-weight: 500; cursor: pointer; background: #fff; border: 0; border-radius: .375rem; }
button:disabled { cursor: not-allowed; opacity: .5; }
.error { margin-bottom: 1rem; color: #fca5a5; font-size: .875rem; }
.links { display: flex; justify-content: space-between; gap: 1rem; margin-top: 1.5rem; font-size: .875rem; }
.links a { color: #9ca3af; }
.links a:hover { color: #f9fafb; }
</style>
