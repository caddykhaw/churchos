<script setup lang="ts">
definePageMeta({
  middleware: [
    'auth',
    () => {
      // Root of the platform app: go straight to the workspace dashboard.
      return navigateTo('/dashboard', { redirectCode: 302 })
    }
  ]
})
</script>

<template>
  <div />
</template>
