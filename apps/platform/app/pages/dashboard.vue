<template>
  <div>
    <header class="page-head">
      <span class="eyebrow">Workspace</span>
      <h1 class="display">{{ org?.name || 'Your church' }}</h1>
      <p v-if="org" class="lead muted">
        {{ org.is_demo ? 'Demo sandbox · sample data · resets when you sign out' : `${org.slug}.churchos.my` }}
      </p>
    </header>

    <section v-if="org && !org.is_demo" class="stat-grid" style="margin-bottom: 34px;">
      <article class="card stat-card">
        <div class="stat-label">Workspace status</div>
        <div class="stat-value">
          <span class="status-dot" :class="statusClass" aria-hidden="true"/>
          <span style="text-transform: capitalize;">{{ statusLabel }}</span>
        </div>
        <p v-if="org.subscription_status === 'inactive'" class="stat-sub">
          Your workspace is ready — it activates once your plan is arranged.
        </p>
        <p v-else-if="org.subscription_status === 'active'" class="stat-sub">
          Active — modules you subscribe to are open below.
        </p>
        <p v-else class="stat-sub">Contact support to restore access.</p>
      </article>

      <article class="card stat-card">
        <div class="stat-label">Modules</div>
        <div class="stat-value">{{ modules.length }}</div>
        <p class="stat-sub">People, Journey & Pages</p>
      </article>

      <article class="card stat-card">
        <div class="stat-label">Next step</div>
        <div class="stat-value" style="font-size:1.05rem;">Activate your plan</div>
        <p class="stat-sub">Your workspace unlocks when you're ready to go live.</p>
      </article>
    </section>

    <section v-if="org">
      <div style="display:flex; align-items:baseline; justify-content:space-between; gap:16px; flex-wrap:wrap; margin-bottom:6px;">
        <h2 class="display" style="font-size:1.5rem;">Modules</h2>
        <NuxtLink to="/account/billing" class="btn btn-ghost btn-sm">
          {{ org.is_demo ? 'Demo info' : 'Plan & workspace' }}
        </NuxtLink>
      </div>
      <p v-if="!org.is_demo" class="muted small" style="max-width:64ch;">
        Modules open as they're included in your plan. During activation your
        workspace is ready but locked.
      </p>
      <p v-else class="muted small" style="max-width:64ch;">
        Every module is unlocked in the demo. Use the "View as" menu above to
        preview how each role sees the app.
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
        Create your workspace to get started — it activates once your plan is arranged.
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
  return 'inactive'
})

const statusLabel = computed(() => {
  const status = org.value?.subscription_status
  if (status === 'active') return 'Active'
  if (status === 'suspended') return 'Suspended'
  if (status === 'cancelled') return 'Cancelled'
  return 'Inactive'
})

const modules = [
  { id: 'people', accent: 'people', code: 'PEOPLE', name: 'People', description: 'Church management — members, families, donations, events, and volunteer scheduling.', href: '/people' },
  { id: 'journey', accent: 'journey', code: 'JOURNEY', name: 'Journey', description: 'Discipleship LMS — teaching tracks, mentors, progress, and certificates.', href: '/journey' },
  { id: 'pages', accent: 'pages', code: 'PAGES', name: 'Pages', description: 'A people-centric website builder with multilingual content.', href: '/pages' },
]
</script>