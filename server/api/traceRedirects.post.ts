interface Hop {
  url: string
  status: number
  statusText: string
}

const MAX_HOPS = 20
// Some ESP tracking domains behave differently for non-browser agents
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

export default defineEventHandler(async (event) => {
  const { url } = await readBody(event)

  if (!url || typeof url !== 'string') {
    throw createError({ statusCode: 400, message: 'Missing url in request body' })
  }

  let current: string
  try {
    current = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).href
  } catch {
    throw createError({ statusCode: 400, message: 'Invalid URL' })
  }

  const hops: Hop[] = []
  const seen = new Set<string>()
  let finalUrl = current
  let error: string | undefined

  for (let i = 0; i < MAX_HOPS; i++) {
    if (seen.has(current)) {
      error = 'Redirect loop detected'
      break
    }
    seen.add(current)

    let response: Response
    try {
      response = await fetch(current, {
        method: 'GET',
        redirect: 'manual',
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(10000)
      })
    } catch (err) {
      console.error('Error tracing redirect:', err)
      error = err instanceof Error && err.name === 'TimeoutError'
        ? `Request timed out: ${current}`
        : `Could not reach: ${current}`
      break
    }

    hops.push({ url: current, status: response.status, statusText: response.statusText })
    finalUrl = current

    const location = response.headers.get('location')
    response.body?.cancel().catch(() => {})

    if (response.status >= 300 && response.status < 400 && location) {
      try {
        current = new URL(location, current).href
      } catch {
        error = `Invalid redirect location: ${location}`
        break
      }
      if (i === MAX_HOPS - 1) {
        error = `Stopped after ${MAX_HOPS} hops`
      }
    } else {
      break
    }
  }

  return { hops, finalUrl, error }
})
