<template>
  <main class="auth-page">
    <section class="auth-card" aria-labelledby="setup-title">
      <NuxtLink v-if="userOrgs.length" to="/dashboard" class="auth-back">
        ← Back to workspace
      </NuxtLink>

      <h1 id="setup-title" class="display auth-title">Set up your church</h1>
      <p class="auth-sub">
        Give your workspace a name and choose an address. Your 14-day free
        trial starts the moment it's created — no credit card required.
      </p>

      <form @submit.prevent="handleCreate">
        <div class="field">
          <label class="field-label" for="org-name">Church name</label>
          <input id="org-name" v-model="name" class="input" required placeholder="Grace Community Church" autocomplete="organization">
        </div>

        <div class="field">
          <label class="field-label" for="org-slug">Your address</label>
          <input id="org-slug" v-model="slug" class="input" required spellcheck="false" placeholder="grace-community" :aria-invalid="slugTaken">
          <p class="field-hint">You'll get <strong class="muted">{{ slug || 'your-church' }}.churchos.my</strong> — lowercase letters, numbers, and hyphens.</p>
        </div>

        <p v-if="slugTaken" class="form-error" role="alert">That address is already taken — try another.</p>
        <p v-if="error && !slugTaken" class="form-error" role="alert">{{ error }}</p>

        <div class="auth-actions">
          <button class="btn btn-primary btn-block" type="submit" :disabled="loading">
            {{ loading ? 'Creating your workspace…' : 'Start my 14-day free trial' }}
          </button>
        </div>
        <p class="field-hint" style="text-align:center; margin-top:12px;">
          You can add People, Journey, or Pages modules later.
        </p>
      </form>
    </section>
  </main>
</template>

<script setup lang="ts">
import { useOrg } from '../../composables/useOrg'

definePageMeta({ middleware: 'auth', layout: false })

const { userOrgs, loadUserOrgs, selectOrg } = useOrg()
const name = ref('')
const slug = ref('')
const slugTaken = ref(false)
const error = ref('')
const loading = ref(false)

watch(slug, () => {
  slugTaken.value = false
  error.value = ''
  slug.value = slug.value.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/-{2,}/g, '-')
})

async function handleCreate() {
  slugTaken.value = false
  error.value = ''
  loading.value = true

  try {
    const result = await $fetch<{ organization: { id: string }, subdomain: string }>('/api/organizations', {
      method: 'POST',
      body: { name: name.value.trim(), slug: slug.value.trim() }
    })

    await selectOrg(result.organization.id)
    await navigateTo('/dashboard')
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'data' in err) {
      const data = err.data
      const message = data && typeof data === 'object' && 'message' in data && typeof data.message === 'string'
        ? data.message
        : ''
      if (message) {
        slugTaken.value = message.toLowerCase().includes('taken')
          || message.toLowerCase().includes('reserved')
        error.value = message
      }
    }
    if (!error.value) {
      error.value = 'Could not create your workspace — please try again.'
    }
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  // Keep the switcher in sync when this page is reached directly.
  void loadUserOrgs()
})
</script>
