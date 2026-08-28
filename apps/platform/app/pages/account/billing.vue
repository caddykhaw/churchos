<script setup lang="ts">
const loading = ref(false)
const error = ref('')
const success = ref('')
const org = ref<any>(null)

const config = useRuntimeConfig()

async function loadOrg() {
  try {
    const session = await $fetch('/api/auth/session')
    const orgData = await $fetch(`/api/organizations/${session.orgId}`)
    org.value = orgData
  } catch (err) {
    console.error(err)
    error.value = 'Failed to load organization data'
  }
}

async function openBillingPortal() {
  loading.value = true
  error.value = ''
  try {
    const response: any = await $fetch('/api/stripe/billing-portal', { method: 'POST' })
    window.location.href = response.url
  } catch (err: any) {
    error.value = err?.data?.message || 'Failed to open billing portal'
  } finally {
    loading.value = false
  }
}

const formatAmount = (amount: number, currency: string = 'MYR') => {
  const formatted = (amount / 100).toFixed(2)
  if (currency === 'MYR') return `RM ${formatted}`
  return `${currency.toUpperCase()} ${formatted}`
}

const formatDate = (dateStr: string) => {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-MY', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

onMounted(() => {
  loadOrg()
})
</script>

<template>
  <div class="min-h-screen bg-[#171717] text-gray-200">
    <header class="border-b border-gray-800">
      <div class="container mx-auto px-6 py-4">
        <NuxtLink to="/" class="text-xl font-bold text-white">ChurchOS</NuxtLink>
      </div>
    </header>

    <main class="container mx-auto px-6 py-12 max-w-3xl">
      <h1 class="text-3xl font-bold text-white mb-8">Billing & Subscription</h1>

      <div v-if="error" class="bg-red-900/20 border border-red-800 text-red-300 p-4 rounded-lg mb-6">
        {{ error }}
      </div>

      <div v-if="success" class="bg-green-900/20 border border-green-800 text-green-300 p-4 rounded-lg mb-6">
        {{ success }}
      </div>

      <!-- Subscription Overview -->
      <div v-if="org" class="border border-gray-800 rounded-lg p-6 mb-6">
        <h2 class="text-xl font-bold text-white mb-4">Current Plan</h2>

        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-3">
            <div>
              <span class="text-gray-500 text-sm">Plan Tier</span>
              <div class="text-white font-medium">{{ org.subscription_tier || 'Not set' }}</div>
            </div>
            <div>
              <span class="text-gray-500 text-sm">Billing Cycle</span>
              <div class="text-white font-medium capitalize">{{ org.billing_cycle || 'N/A' }}</div>
            </div>
            <div>
              <span class="text-gray-500 text-sm">Status</span>
              <div class="font-medium" :class="{
                'text-green-400': org.subscription_status === 'active',
                'text-yellow-400': org.subscription_status === 'trial',
                'text-orange-400': org.subscription_status === 'past_due',
                'text-red-400': org.subscription_status === 'suspended' || org.subscription_status === 'cancelled'
              }">
                {{ org.subscription_status }}
              </div>
            </div>
          </div>

          <div class="space-y-3">
            <div>
              <span class="text-gray-500 text-sm">Trial Ends At</span>
              <div class="text-white font-medium">{{ formatDate(org.trial_ends_at) }}</div>
            </div>
            <div v-if="org.subscription_past_due_at">
              <span class="text-gray-500 text-sm">Past Due Since</span>
              <div class="text-orange-400 font-medium">{{ formatDate(org.subscription_past_due_at) }}</div>
            </div>
            <div v-if="org.subscription_stripe_subscription_id">
              <span class="text-gray-500 text-sm">Stripe Subscription</span>
              <div class="text-gray-400 font-mono text-sm">{{ org.subscription_stripe_subscription_id.slice(0, 20) }}…</div>
            </div>
          </div>
        </div>

        <div class="border-t border-gray-800 mt-6 pt-6">
          <button
            @click="openBillingPortal"
            :disabled="loading"
            class="w-full bg-white text-black py-3 rounded-lg font-medium hover:bg-gray-200 transition disabled:opacity-50"
          >
            {{ loading ? 'Opening...' : 'Manage Subscription & Payment Methods' }}
          </button>
          <p class="text-gray-500 text-xs mt-3">
            You'll be redirected to Stripe's secure portal to update your payment method, change your plan, or cancel.
          </p>
        </div>
      </div>

      <!-- Subscribed Modules -->
      <div v-if="org?.subscribed_modules?.length" class="border border-gray-800 rounded-lg p-6 mb-6">
        <h2 class="text-xl font-bold text-white mb-4">Subscribed Modules</h2>
        <div class="flex flex-wrap gap-3">
          <span
            v-for="module in org.subscribed_modules"
            :key="module"
            class="px-3 py-1 bg-[#2a2a2a] rounded-full text-sm text-gray-300"
          >
            {{ module }}
          </span>
        </div>
      </div>

      <!-- Reactivation fee notice -->
      <div v-if="org?.subscription_status === 'suspended' && org?.suspension_months > 0" class="bg-orange-900/20 border border-orange-800 rounded-lg p-4 mb-6">
        <h3 class="font-bold text-orange-300 mb-2">Account Suspended</h3>
        <p class="text-sm text-gray-300">
          Your subscription has been suspended for {{ org.suspension_months }} month(s).
          A reactivation fee of <strong>RM {{ org.suspension_months * 10 }}</strong> will be charged
          when you resume your subscription.
        </p>
        <button
          @click="openBillingPortal"
          class="mt-3 bg-white text-black py-2 px-4 rounded font-medium hover:bg-gray-200 transition"
        >
          Reactivate Now
        </button>
      </div>
    </main>
  </div>
</template>
