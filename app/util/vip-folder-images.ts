import type { DroppedFile } from '~/util/folder-drop'

// Maps a folder of locally-named images (Hero_Image_URL.png etc) onto the VIP
// CSV image columns, so content can be previewed before URLs are in the CSV.
// Filenames must match the column header exactly - near misses are reported
// with a rename suggestion rather than matched, so naming stays consistent.

export const imageExt = /\.(png|jpe?g|gif|webp)$/i

// Cross-sell pods that a single 'more from sky' image fills
export const MORE_FROM_SKY_COLUMNS = [
  'TV_Customers_Image_URL',
  'BB_Customers_Image_URL',
  'Mobile_Image_URL',
  'TV_BB_Image_URL',
  'TV_BB_Mobile_Image_URL',
  'TV_Mobile_Image_URL',
  'BB_Mobile_Image_URL',
]

// Accepted alternate spellings, rewritten to the column name before the exact
// match. Experiences_ has been used for so long it's treated as valid.
const FILENAME_ALIASES: [RegExp, string][] = [
  [/^Experiences(?=_)/, 'Experience'],
]

function applyAliases(fileStem: string): string {
  return FILENAME_ALIASES.reduce((s, [from, to]) => s.replace(from, to), fileStem)
}

// Only used for 'more from sky' detection and rename suggestions
function looseKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function stem(path: string): string {
  return (path.split('/').pop() ?? path).replace(/\.[^.]+$/, '')
}

function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]!
    row[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j]!
      row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = tmp
    }
  }
  return row[b.length]!
}

// Closest column within a couple of edits (case/punctuation ignored).
// Ties give no suggestion - better silent than pointing at the wrong pod.
function suggestColumn(fileStem: string, columns: string[]): string | undefined {
  const key = looseKey(fileStem)
  let best: string | undefined
  let bestDist = 3
  let tied = false

  for (const column of columns) {
    const dist = editDistance(key, looseKey(column))
    if (dist < bestDist) {
      best = column
      bestDist = dist
      tied = false
    } else if (dist === bestDist) {
      tied = true
    }
  }

  return tied ? undefined : best
}

export interface UnmatchedImage {
  file: string
  suggestion?: string
}

export interface FolderImageMap {
  byColumn: Record<string, string>
  unmatched: UnmatchedImage[]
  revoke(): void
}

export function buildFolderImageMap(images: DroppedFile[], columns: string[]): FolderImageMap {
  const byColumn: Record<string, string> = {}
  const unmatched: UnmatchedImage[] = []
  const created: string[] = []

  const imageColumns = columns.filter(c => c.endsWith('_Image_URL'))
  const columnSet = new Set(imageColumns)

  let moreFromSky: string | null = null

  for (const { path, file } of images) {
    const name = path.split('/').pop() ?? path
    const fileStem = applyAliases(stem(path))
    const isMoreFromSky = looseKey(fileStem) === 'morefromsky'

    if (!columnSet.has(fileStem) && !isMoreFromSky) {
      const suggestion = suggestColumn(fileStem, imageColumns)
      const ext = name.match(/\.[^.]+$/)?.[0] ?? ''
      unmatched.push({ file: name, suggestion: suggestion && `${suggestion}${ext}` })
      continue
    }

    const url = URL.createObjectURL(file)
    created.push(url)

    if (isMoreFromSky) moreFromSky = url
    else byColumn[fileStem] = url
  }

  // Specific pod image wins over the shared one
  if (moreFromSky) {
    for (const column of MORE_FROM_SKY_COLUMNS) {
      byColumn[column] ??= moreFromSky
    }
  }

  return {
    byColumn,
    unmatched,
    revoke() {
      created.forEach(URL.revokeObjectURL)
      created.length = 0
    }
  }
}
