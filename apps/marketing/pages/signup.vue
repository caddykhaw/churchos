<script setup lang="ts">
const churchName = ref('')
const pastorEmail = ref('')
const selectedTier = ref('growth')
const billingCycle = ref('annual')
const loading = ref(false)
const error = ref('')

const tiers = [
  {
    id: 'starter',
    name: 'Starter',
    modules: 'All modules',
    monthly: 'RM 236',
    annual: 'RM 1,982',
    note: '≤ 100 members'
  },
  {
    id: 'growth',
    name: 'Growth',
    modules: 'All modules',
    monthly: 'RM 474',
    annual: 'RM 3,979',
    note: '≤ 300 members'
  },
  {
    id: 'pro',
    name: 'Pro',
    modules: 'All modules',
    monthly: 'RM 746',
    annual: 'RM 6,263',
    note: 'Unlimited members'
  }
]

const handleSubmit = async () => {
  error.value = ''
  loading.value = true
  try {
    const response = await $fetch('/api/stripe/create-checkout', {
      method: 'POST',
      body: {
        churchName: churchName.value,
        pastorEmail: pastorEmail.value,
        tier: selectedTier.value,
        billingCycle: billingCycle.value
      }
    })
    // Redirect to Stripe-hosted Checkout
    window.location.href = (response as any).url
  } catch (err: any) {
    error.value = err?.data?.message || err?.message || 'Something went wrong. Please try again.'
  } finally {
    loading.value = false
  }
}

function selectTier(id: string) {
  selectedTier.value = id
}
</script>

<template>
  <div>
    <header class="nav">
      <div class="container nav-inner">
        <NuxtLink to="/" class="nav-brand" aria-label="ChurchOS home">
          <span class="mark" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4">
              <path d="M7 1 L13 13 H1 Z" />
              <line x1="4" y1="8.5" x2="10" y2="8.5" />
            </svg>
          </span>
          ChurchOS
        </NuxtLink>
        <div class="nav-actions">
          <NuxtLink to="/" class="btn btn-ghost btn-sm">← Back to home</NuxtLink>
        </div>
      </div>
    </header>

    <section class="page-head">
      <div class="container">
        <span class="eyebrow">Free trial</span>
        <h1 class="display">Start your 14-day free trial.</h1>
        <p class="lead" style="margin-top: 16px;">
          Full access to People, Journey, and Pages. No credit card during trial.
        </p>
      </div>
    </section>

    <section style="padding-bottom: 100px;">
      <div class="container form">
        <form @submit.prevent="handleSubmit">
          <div class="form-group">
            <label class="form-label" for="church-name">Church name</label>
            <input
              id="church-name"
              v-model="churchName"
              type="text"
              required
              placeholder="e.g. First Church KL"
              class="form-input"
            />
          </div>

          <div class="form-group">
            <label class="form-label" for="pastor-email">Pastor's email</label>
            <input
              id="pastor-email"
              v-model="pastorEmail"
              type="email"
              required
              placeholder="pastor@firstchurch.my"
              class="form-input"
            />
          </div>

          <div class="form-group">
            <label class="form-label">Choose a plan</label>
            <div class="tier-grid">
              <button
                v-for="tier in tiers"
                :key="tier.id"
                type="button"
                class="tier-option"
                :class="{ active: selectedTier === tier.id }"
                @click="selectTier(tier.id)"
              >
                <div class="name">{{ tier.name }}</div>
                <div class="price">{{ billingCycle === 'annual' ? tier.annual : tier.monthly }}</div>
                <div class="per">{{ billingCycle === 'annual' ? 'billed annually' : tier.note }}</div>
              </button>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Billing cycle</label>
            <div class="radio-row">
              <label class="radio-label">
                <input type="radio" value="annual" v-model="billingCycle" />
                <span>Annual (save 30%)</span>
              </label>
              <label class="radio-label">
                <input type="radio" value="monthly" v-model="billingCycle" />
                <span>Monthly</span>
              </label>
            </div>
          </div>

          <p v-if="error" class="form-error" role="alert">{{ error }}</p>

          <button type="submit" :disabled="loading" class="btn btn-primary" style="width: 100%; margin-top: 8px;">
            {{ loading ? 'Redirecting to payment…' : 'Get Started' }}
          </button>
        </form>

        <p class="small muted" style="margin-top: 20px;">
          By signing up you agree to our <a href="/terms" style="text-decoration: underline;">Terms</a>
          and <a href="/privacy" style="text-decoration: underline;">Privacy Policy</a>.
          Your 14-day trial begins immediately.
        </p>
      </div>
    </section>

    <footer class="footer">
      <div class="container footer-bottom" style="border-top: 0; margin-top: 0; padding-top: 0;">
        <span>© 2026 ChurchOS</span>
        <span>churchos.my</span>
      </div>
    </footer>
  </div>
</template>
