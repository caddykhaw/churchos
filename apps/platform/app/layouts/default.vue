<template>
  <div class="shell">
    <aside class="sidebar">
      <NuxtLink to="/dashboard" class="sidebar-brand" aria-label="ChurchOS dashboard">
        <span class="brand-mark" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4">
            <path d="M7 1 L13 13 H1 Z" />
            <line x1="4" y1="8.5" x2="10" y2="8.5" />
          </svg>
        </span>
        ChurchOS
      </NuxtLink>

      <OrgSwitcher />

      <nav class="side-nav" aria-label="Main navigation">
        <span class="side-nav-label">Workspace</span>
        <NuxtLink to="/dashboard" class="side-link">
          Dashboard
        </NuxtLink>
        <NuxtLink to="/account/billing" class="side-link">
          Billing
        </NuxtLink>
      </nav>

      <div class="sidebar-foot">
        <a href="https://churchos.my" class="side-foot-link" rel="noopener">
          churchos.my
        </a>
        <button class="side-foot-link" style="background:none;border:0;cursor:pointer" @click="signOut">
          Sign out
        </button>
      </div>
    </aside>

    <main class="main">
      <TrialBanner v-if="currentOrg?.subscription_status === 'trial'" />
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
const { currentOrg } = useOrg()

async function signOut() {
  await $fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
  await navigateTo('/auth/login')
}
</script>
