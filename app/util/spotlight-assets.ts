import type { DroppedFile } from '~/util/folder-drop'

// Maps the relative image paths in a built template (images/spot-tv-1.jpg etc)
// onto object URLs for the files that were dropped alongside it.

export interface AssetMap {
  urls: Map<string, string>
  revoke(): void
}

const htmlExt = /\.x?html?$/i
const absoluteUrl = /^(?:https?:|\/\/|data:|cid:|mailto:|tel:|#)/i

function normalise(ref: string): string {
  const trimmed = ref.trim().replace(/^\.?\//, '').split(/[?#]/)[0] ?? ''
  let decoded = trimmed
  try {
    decoded = decodeURIComponent(trimmed)
  } catch {
    // malformed escape, keep the raw string
  }
  return decoded.toLowerCase()
}

export function buildAssetMap(files: DroppedFile[]): AssetMap {
  const urls = new Map<string, string>()
  const created: string[] = []
  const basenameCounts = new Map<string, number>()

  const assets = files.filter(f => !htmlExt.test(f.path))

  for (const { path } of assets) {
    const base = normalise(path.split('/').pop() ?? '')
    basenameCounts.set(base, (basenameCounts.get(base) ?? 0) + 1)
  }

  for (const { path, file } of assets) {
    const url = URL.createObjectURL(file)
    created.push(url)

    urls.set(normalise(path), url)

    // Also key on the bare filename so a flat drop (html + loose images) works.
    // Ambiguous names are skipped — the full path still resolves them.
    const base = normalise(path.split('/').pop() ?? '')
    if (basenameCounts.get(base) === 1) urls.set(base, url)
  }

  return {
    urls,
    revoke() {
      created.forEach(URL.revokeObjectURL)
      created.length = 0
      urls.clear()
    }
  }
}

function lookup(ref: string, urls: Map<string, string>): string | null {
  if (!ref || absoluteUrl.test(ref.trim())) return null

  const key = normalise(ref)
  return urls.get(key) ?? urls.get(key.split('/').pop() ?? '') ?? null
}

const srcAttr = /(<[^>]+?\s(?:src|background|poster)\s*=\s*)(["'])([^"']*)\2/gi
const cssUrl = /url\(\s*(['"]?)([^'")]*)\1\s*\)/gi

// Run this over the rendered output, not the template — image paths built by the
// template's own logic block only exist after EJS has run.
export function rewriteAssetUrls(html: string, assets: AssetMap): string {
  return html
    .replace(srcAttr, (match, lead: string, quote: string, ref: string) => {
      const url = lookup(ref, assets.urls)
      return url ? `${lead}${quote}${url}${quote}` : match
    })
    .replace(cssUrl, (match, quote: string, ref: string) => {
      const url = lookup(ref, assets.urls)
      return url ? `url(${quote}${url}${quote})` : match
    })
}
