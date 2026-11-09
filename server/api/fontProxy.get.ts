// Serves the Sky brand fonts same-origin so the VIPreview screenshot can embed
// them. Fixed list only - callers pick a name, never a URL.
const FONTS: Record<string, string> = {
  regular: 'https://static.skyassets.com/fonts/sky-regular.woff2',
  medium: 'https://static.skyassets.com/fonts/sky-medium.woff2'
}

export default defineEventHandler(async (event) => {
  const { name } = getQuery(event)
  const url = typeof name === 'string' && Object.hasOwn(FONTS, name) ? FONTS[name] : undefined

  if (!url) {
    throw createError({ statusCode: 400, message: 'Unknown font name' })
  }

  const { buffer } = await safeFetchBuffer(url, {
    allowHosts: ['static.skyassets.com'],
    httpsOnly: true,
    maxBytes: 2 * 1024 * 1024
  })

  setHeader(event, 'Content-Type', 'font/woff2')
  setHeader(event, 'Cache-Control', 'public, max-age=86400')
  setHeader(event, 'X-Content-Type-Options', 'nosniff')

  return buffer
})
