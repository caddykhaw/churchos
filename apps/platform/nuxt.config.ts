export default defineNuxtConfig({
  compatibilityDate: '2026-08-24',
  devtools: { enabled: true },

  modules: ['@nuxt/eslint'],

  nitro: {
    preset: 'cloudflare-pages'
  },

  runtimeConfig: {
    // Server-only (never exposed to client)
    stripeSecret: '',
    stripeWebhookSecret: '',
    resendApiKey: '',
    // Public keys (exposed to client)
    public: {
      stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
      platformUrl: process.env.PLATFORM_URL || 'https://app.churchos.my',
      marketingUrl: process.env.MARKETING_URL || 'https://churchos.my',
      supabaseUrl: process.env.NUXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || 'http://localhost:38080',
      supabaseAnonKey: process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '',
    }
  },

  typescript: {
    strict: true
  }
})
