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

      <h1 id="otp-title" class="display auth-title">Sign in with a code</h1>
      <p class="auth-sub">
        Phone and email one-time-code sign-in is now handled by our new
        authentication provider.
      </p>

      <div class="auth-actions">
        <button class="btn btn-primary btn-block" @click="navigateTo('/sign-in')">
          Continue to sign-in →
        </button>
      </div>

      <nav class="auth-links" aria-label="Authentication options">
        <NuxtLink to="/auth/login">Sign in with password</NuxtLink>
      </nav>
    </section>
  </main>
</template>

<script setup lang="ts">
definePageMeta({ layout: false })
</script>
