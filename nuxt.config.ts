// https://nuxt.com/docs/api/configuration/nuxt-config
import { existsSync } from 'node:fs'

// Logos officiels déposés dans public/brands/ (détectés au build)
const brands = ['strava', 'garmin', 'chatgpt'].filter((b) => existsSync(`public/brands/${b}.svg`))

export default defineNuxtConfig({
  compatibilityDate: '2026-11-01',
  devtools: { enabled: false },

  modules: ['@vite-pwa/nuxt'],

  css: ['~/assets/css/themes.css', '~/assets/css/main.css'],

  // Secrets serveur, remplis par les variables d'environnement Vercel :
  // NUXT_SESSION_PASSWORD, NUXT_STRAVA_CLIENT_ID, NUXT_STRAVA_CLIENT_SECRET
  runtimeConfig: {
    sessionPassword: '',
    strava: { clientId: '', clientSecret: '' },
    public: { brands },
  },

  app: {
    // Transitions entre pages et entre layouts (styles dans main.css)
    pageTransition: { name: 'page', mode: 'out-in' },
    layoutTransition: { name: 'layout', mode: 'out-in' },
    head: {
      title: 'stravaXgarmin',
      htmlAttrs: { lang: 'fr' },
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'description', content: 'Le nom de tes courses Garmin, copié sur Strava. Titres et analyses par IA.' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Inter:wght@400;500;600;800;900&family=Urbanist:wght@400;500;600;700&display=swap',
        },
      ],
    },
  },

  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'stravaXgarmin',
      short_name: 'stravaXgarmin',
      description: 'Le nom de tes courses Garmin, copié sur Strava.',
      lang: 'fr',
      start_url: '/',
      display: 'standalone',
      orientation: 'portrait',
      theme_color: '#0B0D17',
      background_color: '#0B0D17',
      icons: [
        { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
        { src: '/pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    generateSW: {
      navigateFallback: '/',
      globPatterns: ['**/*.{js,css,html,png,svg,ico,woff2}'],
    },
    devOptions: { enabled: false },
  },
})
