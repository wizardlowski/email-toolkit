<script setup lang="ts">
useHead({
  title: 'Gif Fix - GIF Frame Reducer'
})

definePageMeta({
  name: 'GifFix'
})

interface FrameInfo {
  index: number
  delayCs: number
}

const sourceFile = ref<File | null>(null)
const frames = ref<FrameInfo[]>([])
const resultFile = ref<File | null>(null)
const resultFrames = ref<FrameInfo[]>([])
const originalUrl = ref('')
const resultUrl = ref('')
const isProcessing = ref(false)
const errorMessage = ref('')

const lossyLevels = [0, 30, 60, 100]
const lossyNames = ['Off', 'Light', 'Medium', 'Strong']
const lossyIndex = ref(0)
const lossyLevel = computed(() => lossyLevels[lossyIndex.value] ?? 0)
const lossyLabel = computed(() => {
  const name = lossyNames[lossyIndex.value] ?? 'Off'
  return lossyLevel.value === 0 ? name : `${name} (${lossyLevel.value})`
})

const sizeRatio = computed(() => {
  if (!sourceFile.value || !resultFile.value) return 0
  return Math.round(((sourceFile.value.size - resultFile.value.size) / sourceFile.value.size) * 100)
})
const originalDuration = computed(() => formatDuration(frames.value))
const resultDuration = computed(() => formatDuration(resultFrames.value))

function formatDuration(list: FrameInfo[]): string {
  // browsers render delays under 2cs as ~10cs
  const totalCs = list.reduce((sum, f) => sum + (f.delayCs < 2 ? 10 : f.delayCs), 0)
  return `${(totalCs / 100).toFixed(1)}s`
}

watchDebounced(lossyIndex, () => {
  if (sourceFile.value && frames.value.length > 0) {
    processGif()
  }
}, { debounce: 400 })

async function handleDropZoneFiles(files: File[]) {
  const file = files[0]
  if (!file) return

  errorMessage.value = ''

  const isGif = file.type === 'image/gif' || await hasGifMagicBytes(file)
  if (!isGif) {
    errorMessage.value = 'Please drop a GIF file.'
    return
  }

  resetState()
  sourceFile.value = file
  originalUrl.value = URL.createObjectURL(file)

  try {
    frames.value = await parseFrameInfo(file)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error)
    return
  }

  if (frames.value.length < 2) {
    errorMessage.value = 'This GIF has only one frame - nothing to fix.'
    return
  }

  await processGif()
}

async function hasGifMagicBytes(file: File): Promise<boolean> {
  const header = await file.slice(0, 6).text()
  return header === 'GIF87a' || header === 'GIF89a'
}

// walk GIF block structure to collect per-frame delays (centiseconds)
async function parseFrameInfo(file: File | Blob): Promise<FrameInfo[]> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const view = new DataView(bytes.buffer)
  let pos = 6 // past GIF87a/GIF89a header

  const screenPacked = bytes[pos + 4]!
  pos += 7
  if (screenPacked & 0x80) pos += 3 * (1 << ((screenPacked & 0x07) + 1)) // global color table

  const parsed: FrameInfo[] = []
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
        parsed.push({ index: parsed.length, delayCs: pendingDelay })
        pendingDelay = 0
        break
      }
      case 0x3b: // trailer
        break walk
      default:
        break walk
    }
  }

  if (parsed.length === 0) {
    throw new Error('Could not read frame info from this GIF.')
  }

  return parsed
}

let rerunQueued = false

async function processGif() {
  if (!sourceFile.value) return
  if (isProcessing.value) {
    // slider moved mid-run: redo with the latest level once this run finishes
    rerunQueued = true
    return
  }

  isProcessing.value = true
  errorMessage.value = ''

  try {
    const { default: gifsicle } = await import('gifsicle-wasm-browser')

    // drop every 4th frame, then slow remaining frames to 75% speed (delay / 0.75)
    // so total duration stays close to the original despite 25% fewer frames.
    // carry spreads centisecond rounding error so duration stays accurate
    const kept = frames.value.filter(f => (f.index + 1) % 4 !== 0)
    let carry = 0
    const selections = kept
      .map(f => {
        const ideal = f.delayCs / 0.75 + carry
        const delay = Math.max(2, Math.round(ideal)) // browsers clamp delays under 2cs
        carry = ideal - delay
        return `-d${delay} #${f.index}`
      })
      .join(' ')
    const lossy = lossyLevel.value > 0 ? ` --lossy=${lossyLevel.value}` : ''
    const command = `-U 1.gif ${selections} -O2${lossy} -o /out/out.gif`

    const out = await gifsicle.run({
      input: [{ file: sourceFile.value, name: '1.gif' }],
      command: [command]
    })

    if (!out?.[0]) {
      throw new Error('GIF processing produced no output.')
    }

    if (resultUrl.value) URL.revokeObjectURL(resultUrl.value)
    resultFile.value = out[0]
    resultUrl.value = URL.createObjectURL(out[0])
    // gifsicle merges runs of identical frames, so read the real stored count
    resultFrames.value = await parseFrameInfo(out[0])
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error)
  } finally {
    isProcessing.value = false
    if (rerunQueued) {
      rerunQueued = false
      processGif()
    }
  }
}

function downloadResult() {
  if (!resultFile.value || !sourceFile.value) return

  const url = URL.createObjectURL(resultFile.value)
  const a = document.createElement('a')
  a.href = url
  a.download = `fixed_${sourceFile.value.name}`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function startOver() {
  resetState()
  lossyIndex.value = 0
}

function resetState() {
  if (originalUrl.value) URL.revokeObjectURL(originalUrl.value)
  if (resultUrl.value) URL.revokeObjectURL(resultUrl.value)
  sourceFile.value = null
  frames.value = []
  resultFile.value = null
  resultFrames.value = []
  originalUrl.value = ''
  resultUrl.value = ''
  errorMessage.value = ''
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

onUnmounted(() => {
  if (originalUrl.value) URL.revokeObjectURL(originalUrl.value)
  if (resultUrl.value) URL.revokeObjectURL(resultUrl.value)
})
</script>

<template>
  <div class="p-4 min-h-full">
    <FileDropZone
      v-if="!sourceFile"
      accept="image/gif"
      :multiple="false"
      icon="image"
      title="Drag and drop a GIF here"
      button-text="Choose GIF"
      :disabled="isProcessing"
      @drop="handleDropZoneFiles"
      @input="handleDropZoneFiles"
      class="mb-4"
    />

    <div v-if="sourceFile" class="flex justify-center mb-4">
      <UButton :disabled="isProcessing" @click="startOver">
        New GIF
      </UButton>
    </div>

    <div class="flex flex-col items-center gap-2 mb-6">
      <USlider
        v-model="lossyIndex"
        :min="0"
        :max="3"
        :step="1"
        class="w-64"
      />
      <span class="text-sm text-neutral-500 dark:text-neutral-400">
        Lossy compression: {{ lossyLabel }}
      </span>
    </div>

    <div v-if="isProcessing" class="text-center mb-6">
      <UBadge color="info" variant="subtle" size="lg" icon="i-lucide-loader-circle" class="[&>svg]:animate-spin">
        Processing GIF...
      </UBadge>
    </div>

    <UAlert
      v-if="errorMessage"
      color="error"
      variant="soft"
      :title="errorMessage"
      icon="i-lucide-circle-alert"
      class="mb-6"
    />

    <UCard v-if="resultFile && sourceFile" :ui="{ body: 'p-4 sm:p-4' }">
      <div class="grid sm:grid-cols-2 gap-4 mb-4">
        <div class="text-center">
          <div class="font-medium mb-2">Original</div>
          <img :src="originalUrl" alt="Original GIF" class="max-w-full mx-auto rounded">
          <div class="text-sm text-neutral-500 dark:text-neutral-400 mt-2">
            {{ formatFileSize(sourceFile.size) }} · {{ frames.length }} frames · {{ originalDuration }}
          </div>
        </div>
        <div class="text-center">
          <div class="font-medium mb-2">Fixed</div>
          <img :src="resultUrl" alt="Fixed GIF" class="max-w-full mx-auto rounded">
          <div class="text-sm text-neutral-500 dark:text-neutral-400 mt-2">
            {{ formatFileSize(resultFile.size) }} · {{ resultFrames.length }} frames · {{ resultDuration }}
          </div>
        </div>
      </div>

      <div class="flex items-center justify-between">
        <div class="text-sm text-neutral-500 dark:text-neutral-400">
          {{ formatFileSize(sourceFile.size) }} → {{ formatFileSize(resultFile.size) }}
          <span v-if="sizeRatio > 0" class="text-green-600 font-medium">({{ sizeRatio }}% smaller)</span>
          <span v-else>(no size reduction)</span>
        </div>
        <UButton color="primary" @click="downloadResult">
          Download
        </UButton>
      </div>
    </UCard>
  </div>
</template>
