<template>
  <div style="display:flex;min-height:100vh;align-items:center;justify-content:center">
    <SignIn :after-sign-in-url="afterUrl" />
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: false })

// After Clerk authenticates the user, the client calls set-session to mint the
// first-party cookie the platform APIs rely on.
const afterUrl = '/auth/handshake'
</script>
