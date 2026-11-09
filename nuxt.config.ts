// 'unsafe-eval' is required: Logik/Spotlight Preview compile EJS templates in the
// browser and Gif Fix runs wasm. 'unsafe-inline' covers Nuxt's hydration payload.
// connect-src is the important one - page scripts can only talk to this origin.
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:",
  "worker-src 'self' blob:",
  "style-src 'self' 'unsafe-inline'",
  "img-src * data: blob:",
  "font-src 'self' data: https://static.skyassets.com",
  "connect-src 'self' blob: data:",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'"
].join('; ')

const securityHeaders = {
  'Content-Security-Policy': contentSecurityPolicy,
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'X-Robots-Tag': 'noindex, nofollow',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()'
}

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: false },
  telemetry: false,
  modules: ['@vueuse/nuxt', '@nuxt/ui', 'nuxt-monaco-editor'],

  css: ['~/assets/css/main.css'],

  runtimeConfig: {
    // Server-only. Set with NUXT_SKYSTORE_API_KEY
    skystoreApiKey: ''
  },

  // Icons come from the bundled lucide set only, never the public Iconify API
  icon: {
    fallbackToApi: false
  },

  vite: {
    optimizeDeps: {
      include: ['gifsicle-wasm-browser']
    }
  },

  compatibilityDate: '2024-11-15',

  nitro: {
    preset: 'netlify' // Enable Netlify functions
  },

  routeRules: {
    '/**': { headers: securityHeaders },
    '/': { prerender: true },
    '/legaleez': { prerender: true },
    '/text-compare': { prerender: true },
    '/logik': { ssr: false },
    '/spotlight-preview': { ssr: false },
    '/tinyimg': { ssr: false },
    '/vip-upload-gen': { ssr: false },
    '/get-store-movies': { ssr: false },
    '/gif-fix': { ssr: false },
  }
})
