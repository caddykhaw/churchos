<script setup lang="ts">
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
      await navigateTo('/')
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
  <div class="min-h-screen bg-[#171717] text-gray-200 flex items-center justify-center">
    <div class="text-center">
      <div v-if="loading">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"/>
        <p class="text-gray-400">Completing your setup...</p>
      </div>
      <div v-else-if="error">
        <p class="text-red-400">{{ error }}</p>
        <p class="text-gray-500 text-sm mt-2">
          You can try <NuxtLink to="/auth/login" class="text-white underline">signing in</NuxtLink> or contact support.
        </p>
      </div>
    </div>
  </div>
</template>
