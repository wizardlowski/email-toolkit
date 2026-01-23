export default defineEventHandler(async () => {
  const response = await $fetch('https://www.skystore.com/api/web/v2/catalog/assets/top/9fe6ace0-0ba3-43d4-8ce2-8b39331244e0/new-to-buy', {
    headers: {
      'Accept': 'application/json',
      'X-API-Key': 'l_web_sparrow',
      'X-API-User-Agent': 'Web/7.4.6'
    }
  })
  return response
})
