export default defineNuxtConfig({
  compatibilityDate: '2026-08-28',
  devtools: { enabled: false },
  ssr: true,
  nitro: {
    preset: 'cloudflare-pages',
    output: {
      publicDir: '../platform/dist'  // Wait no, marketing has its own dist
    }
  },
  app: {
    baseURL: '/',
    head: {
      title: 'ChurchOS — Church Management Platform',
      htmlAttrs: { lang: 'en' },
      meta: [
        { name: 'description', content: 'ChurchOS is a multi-tenant SaaS platform for church management. Journey, People, and Pages all in one place.' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' }
      ],
      link: [{ rel: 'icon', href: '/favicon.ico' }]
    }
  }
})
