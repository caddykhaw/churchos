<template>
  <div class="shell">
    <aside class="sidebar">
      <NuxtLink :to="brandHref" class="sidebar-brand" aria-label="ChurchOS dashboard">
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
        <NuxtLink v-for="item in visibleNav" :key="item.to" :to="item.to" class="side-link">
          {{ item.label }}
        </NuxtLink>
      </nav>

      <div class="sidebar-foot">
        <a href="https://churchos.my" class="side-foot-link" rel="noopener">
          churchos.my
        </a>
        <button class="side-foot-link" style="background:none;border:0;cursor:pointer" @click="signOut">
          {{ isDemoOrg ? 'End demo' : 'Sign out' }}
        </button>
      </div>
    </aside>

    <main class="main">
      <DemoBanner v-if="isDemoOrg" />
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
import { useDemoRole } from '../composables/useOrg'

const { currentOrg } = useOrg()
const { demoRole } = useDemoRole()

const isDemoOrg = computed(() => Boolean(currentOrg.value?.is_demo))

const brandHref = computed(() => (isDemoOrg.value ? '/dashboard' : '/dashboard'))

// Nav is role-filtered inside the demo so visitors can preview each view;
// for real workspaces every member of the org sees the full app.
const visibleNav = computed(() => {
  if (!isDemoOrg.value) {
    return [
      { to: '/dashboard', label: 'Dashboard' },
      { to: '/people', label: 'People' },
      { to: '/journey', label: 'Journey' },
      { to: '/pages', label: 'Pages' },
      { to: '/account/billing', label: 'Plan & workspace' }
    ]
  }

  switch (demoRole.value) {
    case 'member':
      return [
        { to: '/dashboard', label: 'Dashboard' },
        { to: '/people', label: 'People' }
      ]
    case 'mentor':
      return [
        { to: '/dashboard', label: 'Dashboard' },
        { to: '/people', label: 'People' },
        { to: '/journey', label: 'Journey' }
      ]
    case 'volunteer':
      return [
        { to: '/dashboard', label: 'Dashboard' },
        { to: '/people', label: 'People' },
        { to: '/pages', label: 'Pages' }
      ]
    default:
      // admin: the full app.
      return [
        { to: '/dashboard', label: 'Dashboard' },
        { to: '/people', label: 'People' },
        { to: '/journey', label: 'Journey' },
        { to: '/pages', label: 'Pages' },
        { to: '/account/billing', label: 'Plan & workspace' }
      ]
  }
})

async function signOut() {
  await $fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
  await navigateTo(isDemoOrg.value ? '/auth/demo' : '/auth/login')
}
</script>