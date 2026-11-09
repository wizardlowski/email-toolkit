// Some ESP tracking domains behave differently for non-browser agents
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const url = body?.url

  if (!url || typeof url !== 'string') {
    throw createError({ statusCode: 400, message: 'Missing url in request body' })
  }

  let start: string
  try {
    start = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).href
  } catch {
    throw createError({ statusCode: 400, message: 'Invalid URL' })
  }

  return followRedirects(start, { headers: { 'User-Agent': USER_AGENT } })
})
