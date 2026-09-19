export default defineNuxtConfig({
  compatibilityDate: '2026-08-24',
  devtools: { enabled: true },

  modules: ['@clerk/nuxt', '@nuxt/eslint'],

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
    // Server-only keys (never exposed to the client). Turso credentials and
    // the session-signing secret are injected via env at build/deploy time.
    tursoUrl: process.env.TURSO_DATABASE_URL || '',
    tursoAuthToken: process.env.TURSO_AUTH_TOKEN || '',
    jwtSecret: process.env.JWT_SECRET || '',
    resendApiKey: '',
    clerkSecretKey: process.env.NUXT_CLERK_SECRET_KEY || '',
    public: {
      platformUrl: process.env.PLATFORM_URL || 'https://app.churchos.my',
      marketingUrl: process.env.MARKETING_URL || 'https://churchos.my',
      clerkPublishableKey: process.env.NUXT_PUBLIC_CLERK_PUBLISHABLE_KEY || '',
      // The shared demo-sandbox identity shown on the demo entry page.
      demoEmail: process.env.DEMO_EMAIL || 'demo@churchos.my'
    }
  },

  typescript: {
    strict: true
  }
})
