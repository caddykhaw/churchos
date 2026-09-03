<template>
  <div>
    <header class="page-head">
      <span class="eyebrow">Workspace</span>
      <h1 class="display">{{ org?.name || 'Your church' }}</h1>
      <p v-if="org" class="lead muted">{{ org.slug }}.churchos.my</p>
    </header>

    <section v-if="org" class="stat-grid" style="margin-bottom: 34px;">
      <article class="card stat-card">
        <div class="stat-label">Plan status</div>
        <div class="stat-value">
          <span class="status-dot" :class="statusClass" aria-hidden="true"/>
          <span style="text-transform: capitalize;">{{ org.subscription_status }}</span>
        </div>
        <p v-if="trialDaysLeft > 0" class="stat-sub">{{ trialDaysLeft }} day{{ trialDaysLeft === 1 ? '' : 's' }} left in your free trial</p>
        <p v-else-if="org.subscription_status === 'trial'" class="stat-sub">Your trial has ended — add a plan to keep full access.</p>
      </article>

      <article class="card stat-card">
        <div class="stat-label">Modules</div>
        <div class="stat-value">{{ modules.length }}</div>
        <p class="stat-sub">People, Journey & Pages</p>
      </article>

      <article class="card stat-card">
        <div class="stat-label">Next step</div>
        <div class="stat-value" style="font-size:1.05rem;">Add a plan</div>
        <p class="stat-sub">Choose modules when you're ready — no pressure during the trial.</p>
      </article>
    </section>

    <section v-if="org">
      <div style="display:flex; align-items:baseline; justify-content:space-between; gap:16px; flex-wrap:wrap; margin-bottom:6px;">
        <h2 class="display" style="font-size:1.5rem;">Modules</h2>
        <NuxtLink to="/account/billing" class="btn btn-ghost btn-sm">Manage billing</NuxtLink>
      </div>
      <p class="muted small" style="max-width:64ch;">
        All modules are unlocked during your free trial. Open one to start
        building — members, tracks, and your church website live here.
      </p>

      <div class="module-grid">
        <NuxtLink
          v-for="module in modules"
          :key="module.id"
          :to="module.href"
          class="module-card"
          :class="`module-card--${module.accent}`"
        >
          <div class="module-card__inner">
            <header class="module-card__head">
              <span class="module-card__name">{{ module.name }}</span>
              <span class="module-card__code">{{ module.code }}</span>
            </header>
            <p class="module-card__desc">{{ module.description }}</p>
            <span class="module-card__cta">Open module →</span>
          </div>
        </NuxtLink>
      </div>
    </section>

    <section v-else class="empty-state">
      <h2 class="display">Set up your church workspace</h2>
      <p class="muted">
        Create your workspace to start your 14-day free trial with every module unlocked.
      </p>
      <div class="actions">
        <NuxtLink to="/organizations/new" class="btn btn-primary">Create workspace</NuxtLink>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const { currentOrg } = useOrg()

const org = currentOrg

const statusClass = computed(() => {
  const status = org.value?.subscription_status
  if (status === 'active') return 'active'
  if (status === 'suspended' || status === 'cancelled') return 'suspended'
  return 'trial'
})

const trialDaysLeft = computed(() => {
  const trialEndsAt = org.value?.trial_ends_at
  if (!trialEndsAt) return 0
  return Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / 86_400_000))
})

const modules = [
  { id: 'people', accent: 'people', code: 'PEOPLE', name: 'People', description: 'Church management — members, families, donations, events, and volunteer scheduling.', href: '/people' },
  { id: 'journey', accent: 'journey', code: 'JOURNEY', name: 'Journey', description: 'Discipleship LMS — teaching tracks, mentors, progress, and certificates.', href: '/journey' },
  { id: 'pages', accent: 'pages', code: 'PAGES', name: 'Pages', description: 'A people-centric website builder with multilingual content.', href: '/pages' },
]
</script>
