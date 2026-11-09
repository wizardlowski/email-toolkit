const STORE_URL = 'https://www.skystore.com/api/web/v2/catalog/assets/top/9fe6ace0-0ba3-43d4-8ce2-8b39331244e0/new-to-buy'

export default defineEventHandler(async (event) => {
  // Set via NUXT_SKYSTORE_API_KEY
  const { skystoreApiKey } = useRuntimeConfig(event)

  if (!skystoreApiKey) {
    throw createError({ statusCode: 503, message: 'Sky Store API key is not configured' })
  }

  return await $fetch(STORE_URL, {
    headers: {
      'Accept': 'application/json',
      'X-API-Key': skystoreApiKey,
      'X-API-User-Agent': 'Web/7.4.6'
    }
  })
})
