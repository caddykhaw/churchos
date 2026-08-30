<template>
  <div class="app-layout">
    <aside class="sidebar">
      <OrgSwitcher />
      <nav class="nav-menu" aria-label="Main navigation">
        <NuxtLink to="/dashboard">Dashboard</NuxtLink>
      </nav>
    </aside>
    <main class="main-content">
      <TrialBanner v-if="currentOrg?.subscription_status === 'trial'" />
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
const { currentOrg } = useOrg()
</script>

<style scoped>
.app-layout { display: flex; min-height: 100vh; }
.sidebar { width: 15rem; padding: 1rem; background: #f9fafb; border-right: 1px solid #e5e7eb; }
.main-content { flex: 1; padding: 2rem; }
.nav-menu { margin-top: 1.5rem; }
.nav-menu a { display: block; padding: .5rem .75rem; border-radius: .375rem; color: #374151; font-size: .875rem; text-decoration: none; }
.nav-menu a.router-link-active { background: #eff6ff; color: #2563eb; font-weight: 600; }
@media (max-width: 640px) { .app-layout { display: block; } .sidebar { width: auto; border-right: 0; border-bottom: 1px solid #e5e7eb; } .main-content { padding: 1rem; } }
</style>
