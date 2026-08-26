export default defineNuxtConfig({
  compatibilityDate: '2026-08-24',
  devtools: { enabled: true },

  modules: ['@nuxt/eslint'],

  nitro: {
    preset: 'cloudflare-pages'
  },

  runtimeConfig: {
    supabaseUrl: process.env.NUXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321',
    supabaseServiceKey: process.env.NUXT_SUPABASE_SERVICE_KEY || '',
    cloudflareApiToken: process.env.CLOUDFLARE_API_TOKEN || '',
    cloudflareZoneId: process.env.CLOUDFLARE_ZONE_ID || '',
    jwtSecret: process.env.JWT_SECRET || '',
    public: {
      supabaseUrl: process.env.NUXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321',
      supabaseAnonKey: process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY || ''
    }
  },

  typescript: {
    strict: true
  }
})
