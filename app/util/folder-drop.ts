// Reads dropped folders. dataTransfer.files flattens a directory drop and loses
// the paths, so we walk the entry tree instead.

export interface DroppedFile {
  // Path relative to the dropped root, e.g. 'images/spot-tv-1.jpg'
  path: string
  file: File
}

interface FsEntry {
  isFile: boolean
  isDirectory: boolean
  name: string
  file(cb: (f: File) => void, err: (e: unknown) => void): void
  createReader(): { readEntries(cb: (entries: FsEntry[]) => void, err: (e: unknown) => void): void }
}

function entryFile(entry: FsEntry): Promise<File> {
  return new Promise((resolve, reject) => entry.file(resolve, reject))
}

// readEntries returns in batches (100 at a time in Chrome), so keep calling
// until it hands back an empty array.
async function readAll(reader: ReturnType<FsEntry['createReader']>): Promise<FsEntry[]> {
  const all: FsEntry[] = []
  while (true) {
    const batch = await new Promise<FsEntry[]>((resolve, reject) =>
      reader.readEntries(resolve, reject)
    )
    if (!batch.length) return all
    all.push(...batch)
  }
}

async function walk(entry: FsEntry, prefix: string, out: DroppedFile[]) {
  const path = prefix ? `${prefix}/${entry.name}` : entry.name

  if (entry.isFile) {
    out.push({ path, file: await entryFile(entry) })
    return
  }

  if (entry.isDirectory) {
    const entries = await readAll(entry.createReader())
    for (const child of entries) await walk(child, path, out)
  }
}

// Drops the shared top-level folder from every path, so dropping a folder and
// dropping its loose contents produce the same keys.
function stripCommonRoot(files: DroppedFile[]): DroppedFile[] {
  const roots = new Set(files.map(f => f.path.split('/')[0]))
  if (roots.size !== 1) return files

  const everythingNested = files.every(f => f.path.includes('/'))
  if (!everythingNested) return files

  const root = `${[...roots][0]}/`
  return files.map(f => ({ ...f, path: f.path.slice(root.length) }))
}

export async function filesFromDataTransfer(dt: DataTransfer): Promise<DroppedFile[]> {
  // items is emptied once the event handler yields, so collect entries first
  const entries = Array.from(dt.items)
    .map(item => (item.webkitGetAsEntry?.() as unknown as FsEntry | null))
    .filter((e): e is FsEntry => Boolean(e))

  if (!entries.length) {
    return Array.from(dt.files).map(file => ({ path: file.name, file }))
  }

  const out: DroppedFile[] = []
  for (const entry of entries) await walk(entry, '', out)

  return stripCommonRoot(out)
}

export function filesFromInput(list: FileList): DroppedFile[] {
  const out = Array.from(list).map(file => ({
    path: file.webkitRelativePath || file.name,
    file
  }))

  return stripCommonRoot(out)
}
