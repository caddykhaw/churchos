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
    annual: 'RM 1,982'
  },
  {
    id: 'growth',
    name: 'Growth',
    modules: 'All modules',
    monthly: 'RM 474',
    annual: 'RM 3,979'
  },
  {
    id: 'pro',
    name: 'Pro',
    modules: 'All modules',
    monthly: 'RM 746',
    annual: 'RM 6,263'
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
  <div class="min-h-screen bg-[#171717] text-gray-200">
    <header class="container mx-auto px-6 py-8">
      <div class="flex justify-between items-center">
        <NuxtLink to="/" class="text-2xl font-bold text-white">ChurchOS</NuxtLink>
        <NuxtLink to="/" class="text-gray-400 hover:text-white transition-colors">Back to home</NuxtLink>
      </div>
    </header>

    <main class="container mx-auto px-6 py-16 max-w-4xl">
      <div class="text-center mb-12">
        <h1 class="text-4xl font-bold text-white mb-4">Start your 14-day free trial</h1>
        <p class="text-gray-400">No credit card required during trial. Full access to all modules.</p>
      </div>

      <div class="grid lg:grid-cols-2 gap-12">
        <!-- Signup form -->
        <div>
          <form @submit.prevent="handleSubmit" class="space-y-6">
            <div>
              <label for="church-name" class="block text-sm font-medium text-gray-300 mb-2">Church Name</label>
              <input
                id="church-name"
                v-model="churchName"
                type="text"
                required
                placeholder="e.g. First Church KL"
                class="w-full px-4 py-3 bg-[#2a2a2a] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500"
              />
            </div>

            <div>
              <label for="pastor-email" class="block text-sm font-medium text-gray-300 mb-2">Pastor's Email</label>
              <input
                id="pastor-email"
                v-model="pastorEmail"
                type="email"
                required
                placeholder="pastor@firstchurch.my"
                class="w-full px-4 py-3 bg-[#2a2a2a] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-300 mb-2">Choose a plan</label>
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  v-for="tier in tiers"
                  :key="tier.id"
                  type="button"
                  @click="selectTier(tier.id)"
                  class="p-4 text-center border rounded-lg transition-all"
                  :class="selectedTier === tier.id
                    ? 'border-white bg-[#3a3a3a] text-white'
                    : 'border-gray-700 hover:border-gray-500 text-gray-400'"
                >
                  <div class="font-bold">{{ tier.name }}</div>
                  <div class="text-sm mt-1">{{ tier.modules }}</div>
                  <div class="text-lg mt-2 text-white">{{ billingCycle === 'annual' ? tier.annual : tier.monthly }}</div>
                  <div v-if="billingCycle === 'annual'" class="text-xs text-gray-500 mt-1">billed annually</div>
                </button>
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-300 mb-2">Billing Cycle</label>
              <div class="flex gap-4">
                <label class="flex items-center gap-2">
                  <input
                    type="radio"
                    value="annual"
                    v-model="billingCycle"
                    class="text-gray-400 focus:ring-gray-500"
                  />
                  <span>Annual (save 30%)</span>
                </label>
                <label class="flex items-center gap-2">
                  <input
                    type="radio"
                    value="monthly"
                    v-model="billingCycle"
                    class="text-gray-400 focus:ring-gray-500"
                  />
                  <span>Monthly</span>
                </label>
              </div>
            </div>

            <p v-if="error" class="text-red-400 text-sm" role="alert">{{ error }}</p>

            <button
              type="submit"
              :disabled="loading"
              class="w-full bg-white text-black py-3 rounded-lg font-medium hover:bg-gray-200 transition disabled:opacity-50"
            >
              {{ loading ? 'Redirecting to payment...' : 'Get Started' }}
            </button>
          </form>

          <p class="text-gray-500 text-xs mt-4">
            By signing up, you agree to our <a href="/terms" class="hover:text-gray-300">Terms</a> and <a href="/privacy" class="hover:text-gray-300">Privacy Policy</a>.
            You'll get a 14-day free trial before any charge.
          </p>
        </div>

        <!-- Features summary -->
        <div class="space-y-6">
          <div v-for="feature in [
            { title: 'Journey', desc: 'Sermon planning, events, and follow-up workflows' },
            { title: 'People', desc: 'Member directory, groups, and pastoral care' },
            { title: 'Pages', desc: 'Custom church website with multilingual support' }
          ]" :key="feature.title" class="border border-gray-800 p-6 rounded-lg">
            <h3 class="text-xl font-bold text-white mb-2">{{ feature.title }}</h3>
            <p class="text-gray-400">{{ feature.desc }}</p>
          </div>
        </div>
      </div>
    </main>

    <footer class="border-t border-gray-800 py-8 text-center text-gray-500">
      <p>&copy; 2026 ChurchOS. Multi-tenant SaaS for churches.</p>
    </footer>
  </div>
</template>
