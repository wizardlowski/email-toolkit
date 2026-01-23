// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: true },
  modules: ['@vueuse/nuxt', '@nuxt/ui'],

  css: ['~/assets/css/main.css'],

  compatibilityDate: '2024-11-15',

  nitro: {
    preset: 'netlify' // Enable Netlify functions
  },

  routeRules: {
    '/': { prerender: true },
    '/legaleez': { prerender: true },
    '/text-compare': { prerender: true },
    '/logik': { ssr: false },
    '/tinyimg': { ssr: false },
    '/vip-upload-gen': { ssr: false },
    '/get-store-movies': { ssr: false },
  }
})