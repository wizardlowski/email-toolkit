export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const url = body?.url

  if (!url || typeof url !== 'string') {
    throw createError({ statusCode: 400, message: 'Missing url in request body' })
  }

  // Falls back to the original URL if any hop fails or is blocked
  const { finalUrl } = await followRedirects(url)
  return { finalUrl }
})
