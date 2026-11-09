// Fetches VIP newsletter images server-side so the screenshot tool can embed
// them (the image host sends no CORS headers). Locked to that host only.
const ALLOWED_HOSTS = ['res.newsletter.contact.sky']
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif']

export default defineEventHandler(async (event) => {
  const { url } = getQuery(event)

  if (!url || typeof url !== 'string') {
    throw createError({ statusCode: 400, message: 'Missing url parameter' })
  }

  const { buffer, contentType } = await safeFetchBuffer(url, {
    allowHosts: ALLOWED_HOSTS,
    httpsOnly: true
  })

  // Never relay HTML/SVG/script from this origin
  if (!ALLOWED_TYPES.includes(contentType)) {
    throw createError({ statusCode: 415, message: 'Upstream response is not an image' })
  }

  setHeader(event, 'Content-Type', contentType)
  setHeader(event, 'Cache-Control', 'public, max-age=3600')
  setHeader(event, 'X-Content-Type-Options', 'nosniff')
  setHeader(event, 'Content-Security-Policy', "default-src 'none'; sandbox")

  return buffer
})
