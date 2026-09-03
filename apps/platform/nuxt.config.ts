export default defineNuxtConfig({
  compatibilityDate: '2026-08-24',
  devtools: { enabled: true },

  modules: ['@nuxt/eslint'],

  css: ['~/assets/css/main.css'],

  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      title: 'ChurchOS — Church management',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'theme-color', content: '#171717' }
      ],
      link: [
        { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;550;600&family=Newsreader:opsz,wght@6..72,400;6..72,500&display=swap' }
      ]
    }
  },

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
