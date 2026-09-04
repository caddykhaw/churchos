<template>
  <div>
    <header class="page-head">
      <span class="eyebrow">Account</span>
      <h1 class="display">Plan &amp; workspace</h1>
      <p class="lead muted">See your workspace status and which modules are enabled.</p>
    </header>

    <p v-if="error" class="form-error" role="alert">{{ error }}</p>

    <template v-if="org">
      <div v-if="org.is_demo" class="card" style="max-width: 720px;">
        <h2 class="display" style="font-size: 1.25rem; margin-bottom: 14px;">You're exploring the demo sandbox</h2>
        <p class="muted" style="max-width: 62ch;">
          This workspace is a temporary demo copy — everything you see is
          pre-seeded sample data. Changes you make reset when you sign out.
        </p>
        <div style="margin-top: 18px; display:flex; gap:12px; flex-wrap:wrap;">
          <NuxtLink to="/dashboard" class="btn btn-primary">Back to dashboard</NuxtLink>
        </div>
      </div>

      <template v-else>
        <section class="card" style="max-width: 720px;">
          <div class="detail-list">
            <dl>
              <li>
                <dt>Workspace status</dt>
                <dd>
                  <span class="status-dot" :class="statusClass" aria-hidden="true"/>
                  {{ statusLabel }}
                </dd>
              </li>
              <li>
                <dt>Tier</dt>
                <dd>{{ org.subscription_tier || 'starter' }}</dd>
              </li>
              <li>
                <dt>Billing cycle</dt>
                <dd>{{ org.billing_cycle || '—' }}</dd>
              </li>
            </dl>
          </div>
        </section>

        <section v-if="org.subscribed_modules?.length" class="card" style="max-width: 720px;">
          <h2 class="display" style="font-size: 1.25rem; margin-bottom: 14px;">Subscribed modules</h2>
          <div style="display:flex; flex-wrap:wrap; gap:10px;">
            <span
              v-for="module in org.subscribed_modules"
              :key="module"
              class="badge badge-violet"
            >
              {{ module }}
            </span>
          </div>
        </section>

        <section class="card" style="max-width: 720px;">
          <h2 class="display" style="font-size: 1.25rem; margin-bottom: 14px;">Activate your workspace</h2>
          <p class="muted small" style="max-width: 62ch;">
            <template v-if="org.subscription_status === 'inactive'">
              Your workspace is ready but not yet activated. ChurchOS activates
              workspaces once your plan is arranged — reach out to finalise
              modules and pricing.
            </template>
            <template v-else-if="org.subscription_status === 'active'">
              Your workspace is active. If you need to change modules or your
              plan, contact us.
            </template>
            <template v-else>
              This workspace is currently suspended. Contact us to restore access.
            </template>
          </p>
          <div style="margin-top: 18px; display:flex; gap:12px; flex-wrap:wrap;">
            <a
              href="mailto:support@churchos.my?subject=ChurchOS%20plan"
              class="btn btn-primary"
            >
              Contact us about a plan
            </a>
            <NuxtLink to="/dashboard" class="btn btn-ghost">Back to dashboard</NuxtLink>
          </div>
        </section>
      </template>
    </template>

    <div v-else-if="!loading && !error" class="empty-state">
      <h2 class="display">No workspace yet</h2>
      <p class="muted">Create your church workspace to get started.</p>
      <div class="actions">
        <NuxtLink to="/organizations/new" class="btn btn-primary">Create workspace</NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

type BillingOrganization = {
  id: string
  is_demo?: boolean
  subscription_tier?: string | null
  billing_cycle?: string | null
  subscription_status?: 'inactive' | 'active' | 'suspended' | 'cancelled' | null
  subscribed_modules?: string[] | null
}

const loading = ref(true)
const error = ref('')
const org = ref<BillingOrganization | null>(null)

function errorMessage(value: unknown, fallback: string): string {
  if (typeof value === 'object' && value !== null && 'data' in value) {
    const data = value.data
    if (typeof data === 'object' && data !== null && 'message' in data && typeof data.message === 'string') {
      return data.message
    }
  }
  return fallback
}

async function loadOrg() {
  loading.value = true
  error.value = ''
  try {
    org.value = await $fetch<BillingOrganization>('/api/organizations/current')
  } catch (err: unknown) {
    if (typeof err === 'object' && err !== null && 'statusCode' in err && err.statusCode === 400) {
      org.value = null
    } else {
      error.value = errorMessage(err, 'Failed to load organization data')
    }
  } finally {
    loading.value = false
  }
}

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
  return 'Inactive — not yet activated'
})

onMounted(() => {
  void loadOrg()
})
</script>