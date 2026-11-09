import { lookup } from 'node:dns/promises'
import { BlockList, isIP } from 'node:net'

// Guards for endpoints that fetch caller-supplied URLs (SSRF protection).
// Every hop is validated before it is requested, so a public URL cannot
// redirect the server into a private network.

const blocked = new BlockList()

const V4_RANGES: [string, number][] = [
  ['0.0.0.0', 8], // "this" network
  ['10.0.0.0', 8], // private
  ['100.64.0.0', 10], // CGNAT
  ['127.0.0.0', 8], // loopback
  ['169.254.0.0', 16], // link-local, cloud metadata
  ['172.16.0.0', 12], // private
  ['192.0.0.0', 24], // IETF protocol assignments
  ['192.0.2.0', 24], // documentation
  ['192.168.0.0', 16], // private
  ['198.18.0.0', 15], // benchmarking
  ['198.51.100.0', 24], // documentation
  ['203.0.113.0', 24], // documentation
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4] // reserved, broadcast
]

const V6_RANGES: [string, number][] = [
  ['::', 128], // unspecified
  ['::1', 128], // loopback
  ['64:ff9b::', 96], // NAT64
  ['100::', 64], // discard
  ['2001::', 32], // Teredo (wraps an IPv4 address)
  ['2001:db8::', 32], // documentation
  ['2002::', 16], // 6to4 (wraps an IPv4 address)
  ['fc00::', 7], // unique local
  ['fe80::', 10], // link-local
  ['ff00::', 8] // multicast
]

for (const [net, prefix] of V4_RANGES) blocked.addSubnet(net, prefix, 'ipv4')
for (const [net, prefix] of V6_RANGES) blocked.addSubnet(net, prefix, 'ipv6')

function isBlockedAddress(address: string): boolean {
  const family = isIP(address)
  if (family === 4) return blocked.check(address, 'ipv4')
  if (family !== 6) return true

  // IPv4-mapped IPv6 (::ffff:a.b.c.d) must be judged as the IPv4 it points at
  const mapped = address.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i)
  if (mapped?.[1]) return blocked.check(mapped[1], 'ipv4')

  return blocked.check(address, 'ipv6')
}

function badRequest(message: string) {
  return createError({ statusCode: 400, message })
}

export interface UrlGuardOptions {
  // Exact hostnames permitted. Omit to allow any public host.
  allowHosts?: string[]
  httpsOnly?: boolean
}

// Throws a 400 unless the URL is http(s), credential-free, on an allowed host
// and resolves only to public addresses.
export async function assertPublicUrl(raw: string, options: UrlGuardOptions = {}): Promise<URL> {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw badRequest('Invalid URL')
  }

  if (url.protocol !== 'https:' && (options.httpsOnly || url.protocol !== 'http:')) {
    throw badRequest('URL scheme not allowed')
  }
  if (url.username || url.password) {
    throw badRequest('URLs with credentials are not allowed')
  }

  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase()

  if (options.allowHosts && !options.allowHosts.includes(host)) {
    throw badRequest('Host not allowed')
  }

  let addresses: string[]
  if (isIP(host)) {
    addresses = [host]
  } else {
    try {
      addresses = (await lookup(host, { all: true })).map(entry => entry.address)
    } catch {
      throw badRequest(`Could not resolve host: ${host}`)
    }
  }

  if (!addresses.length || addresses.some(isBlockedAddress)) {
    throw badRequest('Host not allowed')
  }

  return url
}

export interface Hop {
  url: string
  status: number
  statusText: string
}

export interface FollowOptions extends UrlGuardOptions {
  maxHops?: number
  timeoutMs?: number
  headers?: Record<string, string>
}

export interface FollowResult {
  hops: Hop[]
  finalUrl: string
  error?: string
}

// Walks a redirect chain one hop at a time, validating each target first.
// Failures are reported in `error` rather than thrown so callers can still
// show the hops that did succeed.
export async function followRedirects(startUrl: string, options: FollowOptions = {}): Promise<FollowResult> {
  const { maxHops = 20, timeoutMs = 10000, headers } = options
  const hops: Hop[] = []
  const seen = new Set<string>()
  let current = startUrl
  let finalUrl = startUrl
  let error: string | undefined

  for (let i = 0; i < maxHops; i++) {
    if (seen.has(current)) {
      error = 'Redirect loop detected'
      break
    }
    seen.add(current)

    try {
      await assertPublicUrl(current, options)
    } catch {
      error = `Blocked (not a public web address): ${current}`
      break
    }

    let response: Response
    try {
      response = await fetch(current, {
        method: 'GET',
        redirect: 'manual',
        headers,
        signal: AbortSignal.timeout(timeoutMs)
      })
    } catch (err) {
      console.error('Error following redirect:', err)
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
      if (i === maxHops - 1) {
        error = `Stopped after ${maxHops} hops`
      }
    } else {
      break
    }
  }

  return { hops, finalUrl, error }
}

export interface SafeFetchOptions extends UrlGuardOptions {
  maxRedirects?: number
  timeoutMs?: number
  maxBytes?: number
}

// Fetches a resource body with every redirect hop validated and a size cap.
export async function safeFetchBuffer(
  startUrl: string,
  options: SafeFetchOptions = {}
): Promise<{ buffer: Buffer, contentType: string }> {
  const { maxRedirects = 3, timeoutMs = 10000, maxBytes = 10 * 1024 * 1024 } = options
  const signal = AbortSignal.timeout(timeoutMs)
  let current = startUrl

  for (let i = 0; i <= maxRedirects; i++) {
    await assertPublicUrl(current, options)

    let response: Response
    try {
      response = await fetch(current, { redirect: 'manual', signal })
    } catch {
      throw createError({ statusCode: 502, message: 'Upstream request failed' })
    }

    const location = response.headers.get('location')
    if (response.status >= 300 && response.status < 400 && location) {
      response.body?.cancel().catch(() => {})
      try {
        current = new URL(location, current).href
      } catch {
        throw createError({ statusCode: 502, message: 'Invalid upstream redirect' })
      }
      continue
    }

    if (!response.ok) {
      response.body?.cancel().catch(() => {})
      throw createError({ statusCode: 502, message: `Upstream responded ${response.status}` })
    }

    if (Number(response.headers.get('content-length')) > maxBytes) {
      response.body?.cancel().catch(() => {})
      throw createError({ statusCode: 413, message: 'Upstream response too large' })
    }

    const chunks: Uint8Array[] = []
    let size = 0
    try {
      for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
        size += chunk.byteLength
        if (size > maxBytes) {
          throw createError({ statusCode: 413, message: 'Upstream response too large' })
        }
        chunks.push(chunk)
      }
    } catch (err) {
      if (isError(err)) throw err
      throw createError({ statusCode: 502, message: 'Upstream request failed' })
    }

    return {
      buffer: Buffer.concat(chunks),
      contentType: (response.headers.get('content-type') || '').split(';')[0]!.trim().toLowerCase()
    }
  }

  throw createError({ statusCode: 502, message: 'Too many upstream redirects' })
}
