<template>
  <div>
    <h1>Dashboard</h1>

    <section v-if="currentOrg" class="dashboard">
      <div class="welcome">
        <h2>Welcome to {{ currentOrg.name }}</h2>
        <p>{{ currentOrg.slug }}.churchos.my</p>
      </div>

      <div class="stats">
        <article class="stat-card"><h3>Subscription</h3><p>{{ currentOrg.subscription_status }}</p></article>
        <article class="stat-card"><h3>Trial ends</h3><p>{{ trialDaysLeft }} days</p></article>
      </div>

      <section>
        <h3>Available modules</h3>
        <div class="module-grid">
          <article v-for="module in modules" :key="module.id" class="module-card">
            <h4>{{ module.name }}</h4>
            <p>{{ module.description }}</p>
            <NuxtLink :to="module.path">Open {{ module.name }}</NuxtLink>
          </article>
        </div>
      </section>
    </section>

    <section v-else>
      <p>Select or create an organization to get started.</p>
      <NuxtLink to="/organizations/new">Create organization</NuxtLink>
    </section>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const { currentOrg } = useOrg()
const modules = [
  { id: 'people', name: 'PEOPLE', description: 'Church management', path: '/people' },
  { id: 'journey', name: 'JOURNEY', description: 'Discipleship LMS', path: '/journey' },
  { id: 'pages', name: 'PAGES', description: 'Website builder', path: '/pages' },
]

const trialDaysLeft = computed(() => {
  const trialEndsAt = currentOrg.value?.trial_ends_at
  if (!trialEndsAt) return 0
  return Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86_400_000))
})
</script>

<style scoped>
.dashboard > * { margin-bottom: 2rem; }
.welcome p { color: #6b7280; }
.stats, .module-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr)); gap: 1rem; }
.stat-card, .module-card { padding: 1.25rem; background: white; border: 1px solid #e5e7eb; border-radius: .5rem; }
.stat-card h3, .module-card h4 { margin-top: 0; }
.module-card a { color: #2563eb; font-weight: 600; text-decoration: none; }
</style>
