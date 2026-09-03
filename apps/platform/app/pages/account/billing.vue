<template>
  <div>
    <header class="page-head">
      <span class="eyebrow">Account</span>
      <h1 class="display">Billing &amp; subscription</h1>
      <p class="lead muted">Manage your plan, modules, and payment details.</p>
    </header>

    <p v-if="error" class="form-error" role="alert">{{ error }}</p>

    <template v-if="org">
      <section class="card" style="max-width: 720px;">
        <div class="detail-list">
          <dl>            <li>
              <dt>Plan status</dt>
              <dd>
                <span class="status-dot" :class="statusClass" aria-hidden="true"/>
                {{ org.subscription_status }}
              </dd>
            </li>
            <li>
              <dt>Trial ends</dt>
              <dd>{{ formatDate(org.trial_ends_at) }}</dd>
            </li>
            <li v-if="org.subscription_tier">
              <dt>Tier</dt>
              <dd>{{ org.subscription_tier }}</dd>
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
        <h2 class="display" style="font-size: 1.25rem; margin-bottom: 14px;">
          {{ org.subscription_status === 'trial' ? 'Choose a plan' : 'Manage subscription' }}
        </h2>
        <p class="muted small" style="max-width: 60ch;">
          <template v-if="org.subscription_status === 'trial'">
            You're on a free trial. Add modules or a full plan through the secure
            billing portal — you'll only be charged after your trial ends.
          </template>
          <template v-else>
            Update your payment method, change modules, or cancel through the
            secure Stripe billing portal.
          </template>
        </p>
        <div style="margin-top: 18px; display:flex; gap:12px; flex-wrap:wrap;">
          <button class="btn btn-primary" :disabled="portalLoading" @click="openBillingPortal">
            {{ portalLoading ? 'Opening…' : 'Open billing portal' }}
          </button>
          <NuxtLink to="/dashboard" class="btn btn-ghost">Back to dashboard</NuxtLink>
        </div>
        <p v-if="portalError" class="form-error" role="alert" style="margin-top:14px;">{{ portalError }}</p>
      </section>

      <section
        v-if="org.subscription_status === 'suspended' && (org.suspension_months ?? 0) > 0"
        class="card"
        style="max-width: 720px; border-color: rgba(248,113,113,.35);"
      >
        <h2 class="display" style="font-size: 1.25rem; margin-bottom: 10px; color:#fca5a5;">Account suspended</h2>
        <p class="muted small" style="max-width: 62ch;">
          Your subscription was suspended for {{ org.suspension_months }} month{{
            (org.suspension_months ?? 0) === 1 ? '' : 's'
          }}. A reactivation fee of
          <strong style="color:#fca5a5;">RM {{ (org.suspension_months ?? 0) * 10 }}</strong>
          applies when you resume.
        </p>
        <button class="btn btn-primary" style="margin-top:16px;" :disabled="portalLoading" @click="openBillingPortal">
          Reactivate now
        </button>
      </section>
    </template>

    <div v-else-if="!loading && !error" class="empty-state">
      <h2 class="display">No workspace yet</h2>
      <p class="muted">Create your church workspace to begin your free trial.</p>
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
  subscription_tier?: string | null
  billing_cycle?: string | null
  subscription_status?: 'trial' | 'active' | 'past_due' | 'suspended' | 'cancelled' | null
  trial_ends_at?: string | null
  subscribed_modules?: string[] | null
  suspension_months?: number | null
}

const loading = ref(true)
const error = ref('')
const org = ref<BillingOrganization | null>(null)
const portalLoading = ref(false)
const portalError = ref('')

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

async function openBillingPortal() {
  portalLoading.value = true
  portalError.value = ''
  try {
    const response = await $fetch<{ url: string }>('/api/stripe/billing-portal', { method: 'POST' })
    window.location.href = response.url
  } catch (err: unknown) {
    portalError.value = errorMessage(err, "Billing isn't set up for this workspace yet — contact support.")
  } finally {
    portalLoading.value = false
  }
}

const statusClass = computed(() => {
  const status = org.value?.subscription_status
  if (status === 'active') return 'active'
  if (status === 'suspended' || status === 'cancelled') return 'suspended'
  return 'trial'
})

const formatDate = (dateStr?: string | null) => {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-MY', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

onMounted(() => {
  void loadOrg()
})
</script>
