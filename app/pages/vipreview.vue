<script setup lang="ts">
import Papa from 'papaparse'
import { toJpeg } from 'html-to-image'
import type { DroppedFile } from '~/util/folder-drop'
import { buildFolderImageMap, imageExt, type FolderImageMap } from '~/util/vip-folder-images'

useHead({
  title: 'VIPreview'
})

const csvFile = ref<File | null>(null)
const fileOpened = ref(false)
const errorMessage = ref('')
const csvData = ref<any[]>([])
const selectedIndex = ref(0)

const showTacticalHero = ref(false)
const showSports = ref(true)
const showRewardsOnRepeat = ref(true)
const showExperience = ref(true)
const showEverydaySavings = ref(true)
const showTvCust = ref(true)
const showBbCust = ref(true)
const showMobileCust = ref(true)
const showTvBb = ref(true)
const showTvBbMobile = ref(true)
const showTvMobile = ref(true)
const showBbMobile = ref(true)
const showExtraEnt = ref(true)

// Pod field mappings configuration
const podFieldMappings = [
  {
    showRef: showSports,
    fields: ['Sports_Heading', 'Sports_1_Image_URL', 'Sports_Copy', 'Sports_CTA_URL', 'Sports_CTA_Copy']
  },
  {
    showRef: showRewardsOnRepeat,
    fields: ['Rewards_on_Repeat_Heading', 'Rewards_on_Repeat_Image_URL', 'Rewards_on_Repeat_Copy', 'Rewards_on_Repeat_CTA_URL', 'Rewards_on_Repeat_CTA_Copy']
  },
  {
    showRef: showExperience,
    fields: ['Experience_Heading', 'Experience_1_Image_URL', 'Experience_Copy', 'Experience_CTA_URL', 'Experience_CTA_Copy']
  },
  {
    showRef: showEverydaySavings,
    fields: ['Everyday_Savings_Heading', 'Everyday_Savings_Image_URL', 'Everyday_Savings_Copy', 'Everyday_Savings_CTA_URL', 'Everyday_Savings_CTA_Copy']
  },
  {
    showRef: showTvCust,
    fields: ['TV_Customers_Heading', 'TV_Customers_Image_URL', 'TV_Customers_Copy', 'TV_Customers_CTA_URL', 'TV_Customers_CTA_Copy']
  },
  {
    showRef: showBbCust,
    fields: ['BB_Customers_Heading', 'BB_Customers_Image_URL', 'BB_Customers_Copy', 'BB_Customers_CTA_URL', 'BB_Customers_CTA_Copy']
  },
  {
    showRef: showMobileCust,
    fields: ['Mobile_Heading', 'Mobile_Image_URL', 'Mobile_Copy', 'Mobile_CTA_URL', 'Mobile_CTA_Copy']
  },
  {
    showRef: showTvBb,
    fields: ['TV_BB_Heading', 'TV_BB_Image_URL', 'TV_BB_Copy', 'TV_BB_CTA_URL', 'TV_BB_CTA_Copy']
  },
  {
    showRef: showTvBbMobile,
    fields: ['TV_BB_Mobile_Heading', 'TV_BB_Mobile_Image_URL', 'TV_BB_Mobile_Copy', 'TV_BB_Mobile_CTA_URL', 'TV_BB_Mobile_CTA_Copy']
  },
  {
    showRef: showTvMobile,
    fields: ['TV_Mobile_Heading', 'TV_Mobile_Image_URL', 'TV_Mobile_Copy', 'TV_Mobile_CTA_URL', 'TV_Mobile_CTA_Copy']
  },
  {
    showRef: showBbMobile,
    fields: ['BB_Mobile_Heading', 'BB_Mobile_Image_URL', 'BB_Mobile_Copy', 'BB_Mobile_CTA_URL', 'BB_Mobile_CTA_Copy']
  },
  {
    showRef: showExtraEnt,
    fields: ['Extra_Entertainment_Heading', 'Extra_Entertainment_Image_URL', 'Extra_Entertainment_Copy', 'Extra_Entertainment_CTA_URL', 'Extra_Entertainment_CTA_Copy']
  }
]

// Validation helper functions
function isFieldValid(value: any): boolean {
  return value !== null && value !== undefined && value !== ''
}

function validatePodFields(data: any, fieldNames: string[]): boolean {
  return fieldNames.every(fieldName => isFieldValid(data[fieldName]))
}

// Auto-hide validation logic
function validateAndUpdatePodVisibility() {
  const data = previewData.value
  if (!data) return

  // Validate each pod, set show ref based on field completeness
  podFieldMappings.forEach(config => {
    const hasAllFields = validatePodFields(data, config.fields)
    config.showRef.value = hasAllFields
  })

  // Hero auto-selection logic
  const standardHeroValid = validatePodFields(data, [
    'Hero_Image_URL', 'Hero_Copy', 'Hero_CTA_URL', 'Hero_CTA_Copy'
  ])
  const tacticalHeroValid = validatePodFields(data, [
    'Tactical_Hero_Image_URL', 'Tactical_Hero_Copy',
    'Tactical_Hero_CTA_URL', 'Tactical_Hero_CTA_Copy'
  ])

  // Auto-select tactical if standard missing but tactical complete
  if (!standardHeroValid && tacticalHeroValid) {
    showTacticalHero.value = true
  } else if (!tacticalHeroValid) {
    showTacticalHero.value = false
  }
}

// Local images from a dropped folder, keyed by CSV column
const folderImages = shallowRef<FolderImageMap | null>(null)
const imageSource = ref<'folder' | 'csv'>('csv')
const hasFolderImages = computed(() => Object.keys(folderImages.value?.byColumn ?? {}).length > 0)

// Watch for CSV data changes, region switches and image source toggle
watch([csvData, selectedIndex, imageSource], () => {
  if (csvData.value.length > 0) {
    validateAndUpdatePodVisibility()
  }
}, { immediate: false })

function csvVersion(path: string): number {
  const match = path.match(/_v(\d+)[^/]*\.csv$/i)
  return match ? Number(match[1]) : -1
}

// Highest _vN wins (exports get re-issued as _v1, _v2...), then shallowest path
function pickCsv(files: DroppedFile[]) {
  return files
    .filter(f => /\.csv$/i.test(f.path))
    .sort((a, b) =>
      csvVersion(b.path) - csvVersion(a.path) ||
      a.path.split('/').length - b.path.split('/').length
    )[0]
}

const csvCount = ref(0)

async function handleFiles(files: DroppedFile[]) {
  errorMessage.value = ''

  const csv = pickCsv(files)
  if (!csv) {
    errorMessage.value = 'No CSV found - drop the folder containing the CSV export'
    return
  }

  csvCount.value = files.filter(f => /\.csv$/i.test(f.path)).length

  try {
    await processFile(csv.file)
  } catch (err) {
    console.error('Error processing file:', err)
    errorMessage.value = 'Error processing file'
    return
  }
  if (!fileOpened.value) return

  folderImages.value?.revoke()
  const images = files.filter(f => imageExt.test(f.path))
  const columns = Object.keys(csvData.value[0] ?? {})
  folderImages.value = images.length ? buildFolderImageMap(images, columns) : null
  imageSource.value = hasFolderImages.value ? 'folder' : 'csv'
}

function reset() {
  folderImages.value?.revoke()
  folderImages.value = null
  imageSource.value = 'csv'
  csvData.value = []
  csvFile.value = null
  fileOpened.value = false
  errorMessage.value = ''
}

onUnmounted(() => folderImages.value?.revoke())

async function readFileWithEncodingDetection(file: File): Promise<string> {
  // First, try to read as UTF-8
  try {
    const text = await file.text()
    // Simple check for common encoding issues - look for replacement characters
    if (!text.includes('\ufffd')) {
      return text
    }
  } catch (error) {
    // If UTF-8 fails, continue to try other encodings
  }

  // Try common encodings if UTF-8 failed or contained replacement characters
  const encodings = ['windows-1252', 'iso-8859-1', 'utf-8']
  
  for (const encoding of encodings) {
    try {
      const arrayBuffer = await file.arrayBuffer()
      const decoder = new TextDecoder(encoding, { fatal: false })
      const text = decoder.decode(arrayBuffer)
      
      // Check if decoding was successful (no replacement characters)
      if (!text.includes('\ufffd')) {
        return text
      }
    } catch (error) {
      // Try next encoding
      continue
    }
  }

  // If all encodings fail, return the UTF-8 attempt as fallback
  return await file.text()
}

async function processFile(file: File) {
  errorMessage.value = ''
  
  const fileExtension = file.name.split('.').pop()?.toLowerCase()
  const isCSV = fileExtension === 'csv' || file.type === 'text/csv'
  
  if (!isCSV) {
    errorMessage.value = 'Error: Please select a CSV file only'
    fileOpened.value = false
    csvFile.value = null
    return
  }

  try {
    const text = await readFileWithEncodingDetection(file)
    await parseCSV(text)
    
    csvFile.value = file
    fileOpened.value = true
  } catch (error) {
    errorMessage.value = 'Error: Failed to read CSV file'
    fileOpened.value = false
    csvFile.value = null
  }
}

function parseCSV(text: string) {
  try {
    const result = Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      transform: (value: string) => value.trim()
    })
    
    if (result.errors.length > 0) {
      console.warn('CSV parsing errors:', result.errors)
    }
    
    csvData.value = result.data as any[]
    selectedIndex.value = 0
  } catch (error) {
    console.error('Error parsing CSV:', error)
    errorMessage.value = 'Error: Failed to parse CSV file'
  }
}

const currentData = computed(() => {
  return csvData.value.length > selectedIndex.value ? csvData.value[selectedIndex.value] : null
})

// CSV row with folder images swapped in; columns without a local image keep the CSV URL
const previewData = computed(() => {
  const row = currentData.value
  if (!row || imageSource.value !== 'folder' || !folderImages.value) return row
  return { ...row, ...folderImages.value.byColumn }
})

const screenshotFrame = templateRef<HTMLDivElement>('email-screenshot')
const isCapturing = ref(false)

async function convertImagesToDataUrls(container: HTMLElement): Promise<Map<HTMLImageElement, string>> {
  const originalSrcs = new Map<HTMLImageElement, string>()
  const images = container.querySelectorAll('img')

  await Promise.all(
    Array.from(images).map(async (img) => {
      const src = img.src
      if (!src || src.startsWith('data:')) return

      originalSrcs.set(img, src)

      try {
        // Local folder images are same-origin blobs, no proxy needed
        const fetchUrl = src.startsWith('blob:') ? src : `/api/imageProxy?url=${encodeURIComponent(src)}`
        const response = await fetch(fetchUrl)
        const blob = await response.blob()

        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader()
          reader.onloadend = () => resolve(reader.result as string)
          reader.readAsDataURL(blob)
        })

        img.src = dataUrl
      } catch (error) {
        console.error('Failed to convert image:', src, error)
      }
    })
  )

  return originalSrcs
}

function restoreImageSrcs(originalSrcs: Map<HTMLImageElement, string>) {
  originalSrcs.forEach((src, img) => {
    img.src = src
  })
}

async function fetchFontAsBase64(url: string): Promise<string> {
  const proxyUrl = `/api/fontProxy?url=${encodeURIComponent(url)}`
  const response = await fetch(proxyUrl)
  const blob = await response.blob()

  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.readAsDataURL(blob)
  })
}

async function buildFontEmbedCSS(): Promise<string> {
  const fonts = [
    { family: 'Sky Text', url: 'https://static.skyassets.com/fonts/sky-regular.woff2' },
    { family: 'Sky Text Medium', url: 'https://static.skyassets.com/fonts/sky-medium.woff2' }
  ]

  const fontFaces = await Promise.all(
    fonts.map(async (font) => {
      try {
        const base64 = await fetchFontAsBase64(font.url)
        return `@font-face { font-family: "${font.family}"; src: url("${base64}") format("woff2"); }`
      } catch (error) {
        console.error('Failed to embed font:', font.family, error)
        return ''
      }
    })
  )

  return fontFaces.filter(Boolean).join('\n')
}

async function takeScreenshot() {
  if (!screenshotFrame.value) return

  isCapturing.value = true

  try {
    const [originalSrcs, fontEmbedCSS] = await Promise.all([
      convertImagesToDataUrls(screenshotFrame.value),
      buildFontEmbedCSS()
    ])

    const dataUrl = await toJpeg(screenshotFrame.value, {
      quality: 0.7,
      fontEmbedCSS,
      backgroundColor: '#ffffff',
      width: screenshotFrame.value.scrollWidth,
      height: screenshotFrame.value.scrollHeight,
      style: {
        margin: '0',
        transform: 'none'
      }
    })

    const link = document.createElement('a')
    link.download = 'vip-newsletter.jpeg'
    link.href = dataUrl
    link.click()

    restoreImageSrcs(originalSrcs)
  } catch (error) {
    console.error('Screenshot failed:', error)
  } finally {
    isCapturing.value = false
  }
}
</script>

<template>
  <div class="p-4 min-h-full">
    <template v-if="!fileOpened">
      <FileDropZone
        directory
        title="Drag and drop the newsletter folder (or just the CSV) here"
        button-text="Choose folder"
        @files="handleFiles"
        class="mb-2"
      />
      <p class="mb-6 text-center text-sm text-neutral-500">
        Images named after their CSV column (e.g. Hero_Image_URL.png) show in place of the CSV URLs.
        A "More from Sky" image fills all the TV/BB/Mobile pods.
      </p>
    </template>

    <UAlert v-if="errorMessage" color="error" variant="soft" :title="errorMessage" icon="i-lucide-circle-alert" class="mb-6" />


    <UCard
      v-if="csvData.length > 0"
      class="fixed bottom-4 right-4 z-10 shadow-lg max-w-md overflow-y-auto"
      :ui="{ body: 'p-4 sm:p-4' }"
    >
      <!-- Loaded CSV -->
      <div v-if="csvFile" class="mb-4 text-xs">
        <label class="block font-bold mb-1">CSV:</label>
        <p class="break-all">{{ csvFile.name }}</p>
        <p v-if="csvCount > 1" class="text-neutral-500">Latest of {{ csvCount }} CSVs in folder</p>
      </div>

      <!-- Image source -->
      <div v-if="hasFolderImages" class="mb-4">
        <label class="block text-xs font-bold mb-2">Images:</label>
        <div class="flex gap-1">
          <UButton
            @click="imageSource = 'folder'"
            :variant="imageSource === 'folder' ? 'solid' : 'ghost'"
            :color="imageSource === 'folder' ? 'primary' : 'neutral'"
            class="flex-1"
            size="sm"
          >
            Folder
          </UButton>
          <UButton
            @click="imageSource = 'csv'"
            :variant="imageSource === 'csv' ? 'solid' : 'ghost'"
            :color="imageSource === 'csv' ? 'primary' : 'neutral'"
            class="flex-1"
            size="sm"
          >
            CSV URLs
          </UButton>
        </div>
      </div>
      <div v-if="folderImages?.unmatched.length" class="mb-4 text-xs text-amber-600 dark:text-amber-400">
        <p class="font-bold mb-1">Images not used - filename must match the CSV column:</p>
        <p v-for="item in folderImages.unmatched" :key="item.file">
          {{ item.file }}<template v-if="item.suggestion"> - rename to <b>{{ item.suggestion }}</b></template>
        </p>
      </div>

      <!-- Region selector -->
      <div v-if="csvData.length > 1" class="mb-4">
        <label class="block text-xs font-bold mb-2">Region:</label>
        <div class="flex gap-1">
          <UButton
            @click="() => {selectedIndex = 0}"
            :variant="selectedIndex === 0 ? 'solid' : 'ghost'"
            :color="selectedIndex === 0 ? 'primary' : 'neutral'"
            class="flex-1"
            size="sm"
          >
            UK
          </UButton>
          <UButton
            @click="() => {selectedIndex = 1}"
            :variant="selectedIndex === 1 ? 'solid' : 'ghost'"
            :color="selectedIndex === 1 ? 'primary' : 'neutral'"
            class="flex-1"
            size="sm"
          >
            ROI
          </UButton>
        </div>
      </div>

      <!-- Screenshot -->
      <div class="mb-4 border-t pt-4">
        <UButton
          @click="takeScreenshot"
          :loading="isCapturing"
          class="text-sm w-full"
        >
          Screenshot
        </UButton>
        <UButton
          @click="reset"
          variant="outline"
          color="neutral"
          class="text-sm w-full mt-2"
          block
        >
          Load another folder
        </UButton>
      </div>

      <!-- Component visibility controls -->
      <div>
        <label class="block text-xs font-bold mb-2">Pods:</label>
        <div class="space-y-3 text-xs">
          <div class="flex items-center gap-3 justify-between">
            <span>Tactical Hero</span>
            <USwitch v-model="showTacticalHero" size="xs" />
          </div>
          <div class="flex items-center gap-3 justify-between">
            <span>Sports</span>
            <USwitch v-model="showSports" size="xs" />
          </div>
          <div class="flex items-center gap-3 justify-between">
            <span>Rewards on Repeat</span>
            <USwitch v-model="showRewardsOnRepeat" size="xs" />
          </div>
          <div class="flex items-center gap-3 justify-between">
            <span>Experience</span>
            <USwitch v-model="showExperience" size="xs" />
          </div>
          <div class="flex items-center gap-3 justify-between">
            <span>Everyday Savings</span>
            <USwitch v-model="showEverydaySavings" size="xs" />
          </div>
          <div class="flex items-center gap-3 justify-between">
            <span>TV Customers</span>
            <USwitch v-model="showTvCust" size="xs" />
          </div>
          <div class="flex items-center gap-3 justify-between">
            <span>BB Customers</span>
            <USwitch v-model="showBbCust" size="xs" />
          </div>
          <div class="flex items-center gap-3 justify-between">
            <span>Mobile Customers</span>
            <USwitch v-model="showMobileCust" size="xs" />
          </div>
          <div class="flex items-center gap-3 justify-between">
            <span>TV + BB</span>
            <USwitch v-model="showTvBb" size="xs" />
          </div>
          <div class="flex items-center gap-3 justify-between">
            <span>TV + BB + Mobile</span>
            <USwitch v-model="showTvBbMobile" size="xs" />
          </div>
          <div class="flex items-center gap-3 justify-between">
            <span>TV + Mobile</span>
            <USwitch v-model="showTvMobile" size="xs" />
          </div>
          <div class="flex items-center gap-3 justify-between">
            <span>BB + Mobile</span>
            <USwitch v-model="showBbMobile" size="xs" />
          </div>
          <div class="flex items-center gap-3 justify-between">
            <span>Extra Entertainment</span>
            <USwitch v-model="showExtraEnt" size="xs" />
          </div>
        </div>
      </div>
    </UCard>

    <div v-if="csvData.length > 0" ref="email-screenshot" class="max-w-[600px] mx-auto shadow-xl text-center py-6 text-[#333] bg-white">
      
      <!-- logo -->
      <img src="https://res.newsletter.contact.sky/res/sky_ids_mid_t/e2eeab4e28f3c67efb69b0c380433eec5360ba0df24231b42c584ce7d7993566.png" alt="Sky" class="w-[100px] h-[62px] mx-auto">
      
      <!-- headline -->
      <h1 class="text-4xl leading-10 mx-12 my-6">
        {{ previewData.Main_Headline }}
      </h1>

      <VIPContent 
        v-if="showTacticalHero"
        :imgUrl="previewData.Tactical_Hero_Image_URL" 
        :text="previewData.Tactical_Hero_Copy"
        :ctaUrl="previewData.Tactical_Hero_CTA_URL"
        :ctaText="previewData.Tactical_Hero_CTA_Copy"
        :csvColumns="{
          imgUrl: 'Tactical Hero Image URL',
          text: 'Tactical Hero Copy',
          ctaUrl: 'Tactical Hero CTA URL',
          ctaText: 'Tactical Hero CTA Copy'
        }"
      />
      <VIPContent 
        v-else
        :imgUrl="previewData.Hero_Image_URL" 
        :text="previewData.Hero_Copy"
        :ctaUrl="previewData.Hero_CTA_URL"
        :ctaText="previewData.Hero_CTA_Copy"
        :csvColumns="{
          imgUrl: 'Hero Image URL',
          text: 'Hero Copy',
          ctaUrl: 'Hero CTA URL',
          ctaText: 'Hero CTA Copy'
        }"
      />

      <VIPContent 
        v-if="showSports"
        :headingText="previewData.Sports_Heading"
        :imgUrl="previewData.Sports_1_Image_URL"
        :text="previewData.Sports_Copy"
        :ctaUrl="previewData.Sports_CTA_URL"
        :ctaText="previewData.Sports_CTA_Copy"
        :csvColumns="{
          headingText: 'Sports Heading',
          imgUrl: 'Sports Image URL',
          text: 'Sports Copy',
          ctaUrl: 'Sports CTA URL',
          ctaText: 'Sports CTA Copy'
        }"
      />

      <VIPContent 
        v-if="showRewardsOnRepeat"
        :headingText="previewData.Rewards_on_Repeat_Heading"
        :imgUrl="previewData.Rewards_on_Repeat_Image_URL"
        :text="previewData.Rewards_on_Repeat_Copy"
        :ctaUrl="previewData.Rewards_on_Repeat_CTA_URL"
        :ctaText="previewData.Rewards_on_Repeat_CTA_Copy"
        :csvColumns="{
          headingText: 'Rewards on Repeat Heading',
          imgUrl: 'Rewards on Repeat Image URL',
          text: 'Rewards on Repeat Copy',
          ctaUrl: 'Rewards on Repeat CTA URL',
          ctaText: 'Rewards on Repeat CTA Copy'
        }"
      />

      <VIPContent 
        v-if="showExperience"
        :headingText="previewData.Experience_Heading"
        :imgUrl="previewData.Experience_1_Image_URL"
        :text="previewData.Experience_Copy"
        :ctaUrl="previewData.Experience_CTA_URL"
        :ctaText="previewData.Experience_CTA_Copy"
        type="cols"
        :csvColumns="{
          headingText: 'Experience Heading',
          imgUrl: 'Experience Image URL',
          text: 'Experience Copy',
          ctaUrl: 'Experience CTA URL',
          ctaText: 'Experience CTA Copy'
        }"
      />

      <VIPContent 
        v-if="showEverydaySavings"
        :headingText="previewData.Everyday_Savings_Heading"
        :imgUrl="previewData.Everyday_Savings_Image_URL"
        :text="previewData.Everyday_Savings_Copy"
        :ctaUrl="previewData.Everyday_Savings_CTA_URL"
        :ctaText="previewData.Everyday_Savings_CTA_Copy"
        :csvColumns="{
          headingText: 'Everyday Savings Heading',
          imgUrl: 'Everyday Savings Image URL',
          text: 'Everyday Savings Copy',
          ctaUrl: 'Everyday Savings CTA URL',
          ctaText: 'Everyday Savings CTA Copy'
        }"
      />

      <VIPContent 
        v-if="showTvCust"
        :headingText="previewData.TV_Customers_Heading"
        :imgUrl="previewData.TV_Customers_Image_URL"
        :text="previewData.TV_Customers_Copy"
        :ctaUrl="previewData.TV_Customers_CTA_URL"
        :ctaText="previewData.TV_Customers_CTA_Copy"
        :csvColumns="{
          headingText: 'TV Customers Heading',
          imgUrl: 'TV Customers Image URL',
          text: 'TV Customers Copy',
          ctaUrl: 'TV Customers CTA URL',
          ctaText: 'TV Customers CTA Copy'
        }"
      />

      <VIPContent 
        v-if="showBbCust"
        :headingText="previewData.BB_Customers_Heading"
        :imgUrl="previewData.BB_Customers_Image_URL"
        :text="previewData.BB_Customers_Copy"
        :ctaUrl="previewData.BB_Customers_CTA_URL"
        :ctaText="previewData.BB_Customers_CTA_Copy"
        :csvColumns="{
          headingText: 'BB Customers Heading',
          imgUrl: 'BB Customers Image URL',
          text: 'BB Customers Copy',
          ctaUrl: 'BB Customers CTA URL',
          ctaText: 'BB Customers CTA Copy'
        }"
      />

      <VIPContent 
        v-if="showMobileCust"
        :headingText="previewData.Mobile_Heading"
        :imgUrl="previewData.Mobile_Image_URL"
        :text="previewData.Mobile_Copy"
        :ctaUrl="previewData.Mobile_CTA_URL"
        :ctaText="previewData.Mobile_CTA_Copy"
        :csvColumns="{
          headingText: 'Mobile Heading',
          imgUrl: 'Mobile Image URL',
          text: 'Mobile Copy',
          ctaUrl: 'Mobile CTA URL',
          ctaText: 'Mobile CTA Copy'
        }"
      />

      <VIPContent 
        v-if="showTvBb"
        :headingText="previewData.TV_BB_Heading"
        :imgUrl="previewData.TV_BB_Image_URL"
        :text="previewData.TV_BB_Copy"
        :ctaUrl="previewData.TV_BB_CTA_URL"
        :ctaText="previewData.TV_BB_CTA_Copy"
        :csvColumns="{
          headingText: 'TV BB Heading',
          imgUrl: 'TV BB Image URL',
          text: 'TV BB Copy',
          ctaUrl: 'TV BB CTA URL',
          ctaText: 'TV BB CTA Copy'
        }"
      />

      <VIPContent 
        v-if="showTvBbMobile"
        :headingText="previewData.TV_BB_Mobile_Heading"
        :imgUrl="previewData.TV_BB_Mobile_Image_URL"
        :text="previewData.TV_BB_Mobile_Copy"
        :ctaUrl="previewData.TV_BB_Mobile_CTA_URL"
        :ctaText="previewData.TV_BB_Mobile_CTA_Copy"
        :csvColumns="{
          headingText: 'TV BB Mobile Heading',
          imgUrl: 'TV BB Mobile Image URL',
          text: 'TV BB Mobile Copy',
          ctaUrl: 'TV BB Mobile CTA URL',
          ctaText: 'TV BB Mobile CTA Copy'
        }"
      />

      <VIPContent 
        v-if="showTvMobile"
        :headingText="previewData.TV_Mobile_Heading"
        :imgUrl="previewData.TV_Mobile_Image_URL"
        :text="previewData.TV_Mobile_Copy"
        :ctaUrl="previewData.TV_Mobile_CTA_URL"
        :ctaText="previewData.TV_Mobile_CTA_Copy"
        :csvColumns="{
          headingText: 'TV Mobile Heading',
          imgUrl: 'TV Mobile Image URL',
          text: 'TV Mobile Copy',
          ctaUrl: 'TV Mobile CTA URL',
          ctaText: 'TV Mobile CTA Copy'
        }"
      />

      <VIPContent 
        v-if="showBbMobile"
        :headingText="previewData.BB_Mobile_Heading"
        :imgUrl="previewData.BB_Mobile_Image_URL"
        :text="previewData.BB_Mobile_Copy"
        :ctaUrl="previewData.BB_Mobile_CTA_URL"
        :ctaText="previewData.BB_Mobile_CTA_Copy"
        :csvColumns="{
          headingText: 'BB Mobile Heading',
          imgUrl: 'BB Mobile Image URL',
          text: 'BB Mobile Copy',
          ctaUrl: 'BB Mobile CTA URL',
          ctaText: 'BB Mobile CTA Copy'
        }"
      />

      <VIPContent 
        v-if="showExtraEnt"
        :headingText="previewData.Extra_Entertainment_Heading"
        :imgUrl="previewData.Extra_Entertainment_Image_URL"
        :text="previewData.Extra_Entertainment_Copy"
        :ctaUrl="previewData.Extra_Entertainment_CTA_URL"
        :ctaText="previewData.Extra_Entertainment_CTA_Copy"
        :csvColumns="{
          headingText: 'Extra Entertainment Heading',
          imgUrl: 'Extra Entertainment Image URL',
          text: 'Extra Entertainment Copy',
          ctaUrl: 'Extra Entertainment CTA URL',
          ctaText: 'Extra Entertainment CTA Copy'
        }"
      />

      <p class="text-[21px] leading-6 mt0 mx-6 mb-12">
        <b>{{ previewData.Signoff_Copy }}</b>
      </p>

      <div class="h-1.5 gradient"></div>

      <div>
        <img src="https://res.newsletter.contact.sky/res/img/0990D9D2426E04156EA51E87F3C7235F.png" alt="Sky" class="w-[74px] h-[45px] my-10 mx-auto" />
        <p class="text-[10px] leading-3.5 mb-4 mx-7 font-arial">
          <a href="#" class="underline">Privacy Policy</a> | <a href="#" class="underline">Terms and Conditions</a> | <a href="#" class="underline">Contact us</a> | <a href="#" class="underline">My Account</a>
          <br><br>
          You were sent this email as part of your Sky VIP membership.<br>
          If you do not want to continue to receive these newsletters please <a href="#" class="underline">click on this link</a>.
          <br><br>
          Please do not reply to this email as this address is not&nbsp;monitored.
          <template v-if="previewData.Legal_Copy">
            <br><br>
            {{ previewData.Legal_Copy }}
          </template>
          <template v-if="previewData.Legal_Copy_Extra">
            <br><br>
            {{ previewData.Legal_Copy_Extra }}
          </template>
          <br><br>
          &#169; {{ new Date().getFullYear() }} Sky UK Ltd. Sky UK Ltd (company no. 02906991) has its registered office at Grant Way, Isleworth, Middlesex&nbsp;TW7&nbsp;5QD.
        </p>
      </div>
    </div>
  </div>
</template>

<style>
.gradient {
  background-image: linear-gradient(to right, rgb(255, 140, 0) 5%, rgb(248, 0, 50) 25%, rgb(255, 0, 160) 45%, rgb(140, 40, 255) 65%, rgb(0, 35, 255) 82%, rgb(25, 160, 255) 96%);
}
</style>