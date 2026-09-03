export default defineNuxtConfig({
  compatibilityDate: '2026-08-28',
  devtools: { enabled: false },
  ssr: true,
  nitro: {
    preset: 'cloudflare-pages'
  },
  routeRules: {
    // Signup/registration lives on the app (app.churchos.my), not the marketing site.
    '/signup': { redirect: 'https://app.churchos.my/auth/signup' }
  },
  css: ['~/assets/css/main.css'],
  app: {
    baseURL: '/',
    head: {
      htmlAttrs: { lang: 'en' },
      title: 'ChurchOS — Church management for Malaysia',
      meta: [
        { name: 'description', content: 'People, discipleship, and a church website — one quiet, dependable system. Built for Malaysian churches of every size.' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'theme-color', content: '#171717' },
        { property: 'og:title', content: 'ChurchOS — Church management for Malaysia' },
        { property: 'og:description', content: 'People, discipleship, and a church website — one quiet, dependable system. Built for Malaysian churches of every size.' },
        { property: 'og:type', content: 'website' },
        { property: 'og:url', content: 'https://churchos.my' }
      ],
      link: [
        { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;550;600&family=Newsreader:opsz,wght@6..72,400;6..72,500&display=swap' }
      ]
    }
  }
})
