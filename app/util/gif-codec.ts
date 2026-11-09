// GIF helpers for Gif Fix: read timing metadata, pick which frames to drop,
// and write fully rendered frames back out as a plain (unoptimized) GIF.
// Size optimization is left to gifsicle afterwards.

export interface GifMeta {
  width: number
  height: number
  // centiseconds per frame, as stored in the file
  delays: number[]
  // NETSCAPE loop count: 0 = forever, null = extension absent (plays once)
  loopCount: number | null
}

export interface PlannedFrame {
  // index of the source frame to keep
  index: number
  // how long it stays on screen, including the frames dropped after it
  delayCs: number
}

// Browsers render delays under 2cs as 10cs
export function effectiveDelay(delayCs: number): number {
  return delayCs < 2 ? 10 : delayCs
}

// Walks the GIF block structure for canvas size, loop count and frame delays
export function parseGifMeta(buffer: ArrayBuffer): GifMeta {
  const bytes = new Uint8Array(buffer)
  const view = new DataView(buffer)
  let pos = 6 // past GIF87a/GIF89a header

  const width = view.getUint16(pos, true)
  const height = view.getUint16(pos + 2, true)
  const screenPacked = bytes[pos + 4]!
  pos += 7
  if (screenPacked & 0x80) pos += 3 * (1 << ((screenPacked & 0x07) + 1)) // global color table

  const delays: number[] = []
  let loopCount: number | null = null
  let pendingDelay = 0

  const skipSubBlocks = () => {
    while (pos < bytes.length) {
      const size = bytes[pos]!
      pos += 1
      if (size === 0) break
      pos += size
    }
  }

  walk: while (pos < bytes.length) {
    const block = bytes[pos]!
    pos += 1
    switch (block) {
      case 0x21: { // extension
        const label = bytes[pos]!
        pos += 1
        if (label === 0xf9) { // graphic control extension holds the frame delay
          const size = bytes[pos]!
          pendingDelay = view.getUint16(pos + 2, true)
          pos += 1 + size + 1
        } else if (label === 0xff) { // application extension, may hold the loop count
          const id = String.fromCharCode(...bytes.subarray(pos + 1, pos + 12))
          if ((id === 'NETSCAPE2.0' || id === 'ANIMEXTS1.0') && bytes[pos + 12] === 3 && bytes[pos + 13] === 1) {
            loopCount = view.getUint16(pos + 14, true)
          }
          skipSubBlocks()
        } else {
          skipSubBlocks()
        }
        break
      }
      case 0x2c: { // image descriptor = one frame
        const imgPacked = bytes[pos + 8]!
        pos += 9
        if (imgPacked & 0x80) pos += 3 * (1 << ((imgPacked & 0x07) + 1)) // local color table
        pos += 1 // LZW min code size
        skipSubBlocks()
        delays.push(pendingDelay)
        pendingDelay = 0
        break
      }
      default: // trailer or unknown
        break walk
    }
  }

  if (delays.length === 0) {
    throw new Error('Could not read frame info from this GIF.')
  }

  return { width, height, delays, loopCount }
}

// Chooses which frames to keep: every `every`th frame is dropped and its time
// is handed to the kept frame before it, so total duration is unchanged.
// Frames held longer than `holdCs` are pauses in the animation, not motion, and
// are never dropped.
export function planFrames(delays: number[], every = 4, holdCs = 10): PlannedFrame[] {
  const plan: PlannedFrame[] = []
  let count = 0

  delays.forEach((raw, index) => {
    const delay = effectiveDelay(raw)
    const last = plan[plan.length - 1]
    count++

    if (count === every) {
      count = 0
      if (last && delay <= holdCs) {
        last.delayCs += delay
        return
      }
    }

    plan.push({ index, delayCs: delay })
  })

  return plan
}

interface IndexedFrame {
  indices: Uint8Array
  palette: Uint8Array // r,g,b triplets
  transparentIndex: number // -1 when the frame is fully opaque
  reduced: boolean // true if colors had to be merged to fit 256
}

const TRANSPARENT = -1

function colorKey(rgba: Uint8ClampedArray, offset: number): number {
  // GIF alpha is on/off
  if (rgba[offset + 3]! < 128) return TRANSPARENT
  return (rgba[offset]! << 16) | (rgba[offset + 1]! << 8) | rgba[offset + 2]!
}

// Median cut: split the color set until it fits, returning color -> palette slot
function reduceColors(counts: Map<number, number>, maxColors: number): { palette: number[], slots: Map<number, number> } {
  type Box = { colors: number[], weight: number }
  const channel = (color: number, c: number) => (color >> (16 - c * 8)) & 0xff
  const makeBox = (colors: number[]): Box => ({
    colors,
    weight: colors.reduce((sum, color) => sum + counts.get(color)!, 0)
  })

  const boxes: Box[] = [makeBox([...counts.keys()])]

  while (boxes.length < maxColors) {
    // split the most-used box that still holds more than one color
    let target = -1
    for (let i = 0; i < boxes.length; i++) {
      if (boxes[i]!.colors.length > 1 && (target === -1 || boxes[i]!.weight > boxes[target]!.weight)) target = i
    }
    if (target === -1) break

    const box = boxes[target]!
    let widest = 0
    let widestRange = -1
    for (let c = 0; c < 3; c++) {
      let min = 255
      let max = 0
      for (const color of box.colors) {
        const v = channel(color, c)
        if (v < min) min = v
        if (v > max) max = v
      }
      if (max - min > widestRange) {
        widestRange = max - min
        widest = c
      }
    }

    box.colors.sort((a, b) => channel(a, widest) - channel(b, widest))
    let running = 0
    let cut = 1
    for (let i = 0; i < box.colors.length - 1; i++) {
      running += counts.get(box.colors[i]!)!
      cut = i + 1
      if (running >= box.weight / 2) break
    }

    boxes.splice(target, 1, makeBox(box.colors.slice(0, cut)), makeBox(box.colors.slice(cut)))
  }

  const palette: number[] = []
  const slots = new Map<number, number>()
  boxes.forEach((box, slot) => {
    let r = 0
    let g = 0
    let b = 0
    for (const color of box.colors) {
      const n = counts.get(color)!
      r += channel(color, 0) * n
      g += channel(color, 1) * n
      b += channel(color, 2) * n
      slots.set(color, slot)
    }
    palette.push(Math.round(r / box.weight), Math.round(g / box.weight), Math.round(b / box.weight))
  })

  return { palette, slots }
}

// Turns one rendered RGBA frame into palette indices. Exact when the frame has
// 256 colors or fewer (the normal case); otherwise colors are merged to fit.
function indexFrame(rgba: Uint8ClampedArray): IndexedFrame {
  const pixelCount = rgba.length / 4
  const counts = new Map<number, number>()
  let hasTransparency = false

  for (let i = 0; i < pixelCount; i++) {
    const key = colorKey(rgba, i * 4)
    if (key === TRANSPARENT) hasTransparency = true
    else counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  const maxColors = hasTransparency ? 255 : 256
  const reduced = counts.size > maxColors
  let palette: number[] = []
  let slots = new Map<number, number>()

  if (reduced) {
    ({ palette, slots } = reduceColors(counts, maxColors))
  } else {
    for (const color of counts.keys()) {
      slots.set(color, slots.size)
      palette.push((color >> 16) & 0xff, (color >> 8) & 0xff, color & 0xff)
    }
  }

  let transparentIndex = -1
  if (hasTransparency) {
    transparentIndex = palette.length / 3
    palette.push(0, 0, 0)
  }

  const indices = new Uint8Array(pixelCount)
  let lastKey = -2
  let lastSlot = 0
  for (let i = 0; i < pixelCount; i++) {
    const key = colorKey(rgba, i * 4)
    if (key !== lastKey) {
      lastKey = key
      lastSlot = key === TRANSPARENT ? transparentIndex : slots.get(key)!
    }
    indices[i] = lastSlot
  }

  return { indices, palette: Uint8Array.from(palette), transparentIndex, reduced }
}

// Standard GIF variable-width LZW, output already split into sub-blocks
function lzwEncode(indices: Uint8Array, minCodeSize: number): Uint8Array {
  const clearCode = 1 << minCodeSize
  const eoiCode = clearCode + 1
  const out: number[] = []
  let blockStart = 0
  let codeSize = minCodeSize + 1
  let nextCode = eoiCode + 1
  let bitBuffer = 0
  let bitCount = 0
  let table = new Map<number, number>()

  const startBlock = () => {
    blockStart = out.length
    out.push(0) // length byte, filled in when the block closes
  }
  const pushByte = (byte: number) => {
    out.push(byte)
    if (out.length - blockStart - 1 === 255) {
      out[blockStart] = 255
      startBlock()
    }
  }
  const emit = (code: number) => {
    bitBuffer |= code << bitCount
    bitCount += codeSize
    while (bitCount >= 8) {
      pushByte(bitBuffer & 0xff)
      bitBuffer >>>= 8
      bitCount -= 8
    }
  }

  startBlock()
  emit(clearCode)

  let prefix = indices[0]!
  for (let i = 1; i < indices.length; i++) {
    const value = indices[i]!
    const key = (prefix << 8) | value
    const existing = table.get(key)
    if (existing !== undefined) {
      prefix = existing
      continue
    }

    emit(prefix)
    if (nextCode === 4096) {
      emit(clearCode)
      nextCode = eoiCode + 1
      codeSize = minCodeSize + 1
      table = new Map()
    } else {
      if (nextCode >= (1 << codeSize)) codeSize++
      table.set(key, nextCode++)
    }
    prefix = value
  }

  emit(prefix)
  emit(eoiCode)
  if (bitCount > 0) pushByte(bitBuffer & 0xff)

  const used = out.length - blockStart - 1
  if (used > 0) {
    out[blockStart] = used
    out.push(0) // block terminator
  }
  // an empty trailing block already reads as the terminator

  return Uint8Array.from(out)
}

export interface RenderedFrame {
  rgba: Uint8ClampedArray
  delayCs: number
}

export interface EncodedGif {
  blob: Blob
  // frames (0-based, in output order) whose colors had to be merged to fit 256
  reducedFrames: number[]
}

// Writes full-canvas frames, each with its own palette. Every frame is complete
// on its own, so nothing depends on the frame before it.
export function encodeGif(
  width: number,
  height: number,
  loopCount: number | null,
  frames: RenderedFrame[]
): EncodedGif {
  const u16 = (n: number) => [n & 0xff, (n >> 8) & 0xff]
  const parts: BlobPart[] = []
  const reducedFrames: number[] = []

  const indexed = frames.map(frame => indexFrame(frame.rgba))
  // Transparent pixels only show through if the canvas is cleared between frames
  const disposal = indexed.some(f => f.transparentIndex !== -1) ? 2 : 1

  parts.push(Uint8Array.from([
    ...[...'GIF89a'].map(c => c.charCodeAt(0)),
    ...u16(width), ...u16(height),
    0x70, 0, 0 // no global color table
  ]))

  if (loopCount !== null) {
    parts.push(Uint8Array.from([
      0x21, 0xff, 0x0b,
      ...[...'NETSCAPE2.0'].map(c => c.charCodeAt(0)),
      3, 1, ...u16(loopCount), 0
    ]))
  }

  indexed.forEach((frame, i) => {
    if (frame.reduced) reducedFrames.push(i)

    const colorCount = frame.palette.length / 3
    let tableBits = 1
    while ((1 << tableBits) < colorCount) tableBits++
    const table = new Uint8Array(3 * (1 << tableBits))
    table.set(frame.palette)

    const hasTransparency = frame.transparentIndex !== -1
    parts.push(Uint8Array.from([
      0x21, 0xf9, 4,
      (disposal << 2) | (hasTransparency ? 1 : 0),
      ...u16(frames[i]!.delayCs),
      hasTransparency ? frame.transparentIndex : 0,
      0,
      0x2c, 0, 0, 0, 0, ...u16(width), ...u16(height),
      0x80 | (tableBits - 1)
    ]))
    parts.push(table)

    const minCodeSize = Math.max(2, tableBits)
    parts.push(Uint8Array.from([minCodeSize]))
    parts.push(lzwEncode(frame.indices, minCodeSize))
  })

  parts.push(Uint8Array.from([0x3b]))

  return { blob: new Blob(parts, { type: 'image/gif' }), reducedFrames }
}

// Mean absolute difference per color channel (0-255) between two rendered frames
export function frameDifference(a: Uint8ClampedArray, b: Uint8ClampedArray): number {
  if (a.length !== b.length) return 255
  let total = 0
  for (let i = 0; i < a.length; i += 4) {
    const aClear = a[i + 3]! < 128
    const bClear = b[i + 3]! < 128
    if (aClear || bClear) {
      if (aClear !== bClear) total += 255 * 3
      continue
    }
    total += Math.abs(a[i]! - b[i]!) + Math.abs(a[i + 1]! - b[i + 1]!) + Math.abs(a[i + 2]! - b[i + 2]!)
  }
  return total / ((a.length / 4) * 3)
}
