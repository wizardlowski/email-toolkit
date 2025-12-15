export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const url = query.url as string

  if (!url) {
    throw createError({ statusCode: 400, message: 'Missing url parameter' })
  }

  try {
    const response = await fetch(url)

    if (!response.ok) {
      throw createError({ statusCode: response.status, message: 'Failed to fetch font' })
    }

    const buffer = await response.arrayBuffer()
    const contentType = response.headers.get('content-type') || 'font/woff2'

    setHeader(event, 'Content-Type', contentType)
    setHeader(event, 'Cache-Control', 'public, max-age=86400')
    setHeader(event, 'Access-Control-Allow-Origin', '*')

    return Buffer.from(buffer)
  } catch (error) {
    console.error('Font proxy error:', error)
    throw createError({ statusCode: 500, message: 'Failed to proxy font' })
  }
})
