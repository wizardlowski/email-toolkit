<script setup lang="ts">
import Papa from 'papaparse'
import { toJpeg } from 'html-to-image'

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
    fields: ['Sports_Heading', 'Sports_1_Image_URL', 'Sports_2_Image_URL', 'Sports_3_Image_URL', 'Sports_Copy', 'Sports_CTA_URL', 'Sports_CTA_Copy']
  },
  {
    showRef: showRewardsOnRepeat,
    fields: ['Rewards_on_Repeat_Heading', 'Rewards_on_Repeat_Image_URL', 'Rewards_on_Repeat_Copy', 'Rewards_on_Repeat_CTA_URL', 'Rewards_on_Repeat_CTA_Copy']
  },
  {
    showRef: showExperience,
    fields: ['Experience_Heading', 'Experience_1_Image_URL', 'Experience_2_Image_URL', 'Experience_3_Image_URL', 'Experience_Copy', 'Experience_CTA_URL', 'Experience_CTA_Copy']
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
  const data = currentData.value
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

// Watch for CSV data changes and region switches
watch([csvData, selectedIndex], () => {
  if (csvData.value.length > 0) {
    validateAndUpdatePodVisibility()
  }
}, { immediate: false })

async function handleDropZoneFiles(files: File[]) {
  if (files.length === 0) {
    return
  }

  if (files.length > 1) {
    errorMessage.value = 'Please drop only one CSV file at a time'
    return
  }

  const file = files[0]
  if (file) {
    processFile(file).catch(err => {
      console.error('Error processing file:', err)
      errorMessage.value = 'Error processing file'
    })
  }
}

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
        const proxyUrl = `/api/imageProxy?url=${encodeURIComponent(src)}`
        const response = await fetch(proxyUrl)
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
    <FileDropZone 
      v-if="!fileOpened"
      accept=".csv,text/csv" 
      title="Drag and drop CSV file here"
      button-text="Choose CSV File"
      @drop="handleDropZoneFiles"
      @input="handleDropZoneFiles"
      class="mb-6"
    />

    <UAlert v-if="errorMessage" color="error" variant="soft" :title="errorMessage" icon="i-lucide-circle-alert" class="mb-6" />


    <UCard
      v-if="csvData.length > 0"
      class="fixed bottom-4 right-4 z-10 shadow-lg max-w-md overflow-y-auto"
      :ui="{ body: 'p-4 sm:p-4' }"
    >
      <!-- Region selector -->
      <div v-if="csvData.length > 1" class="mb-4">
        <label class="block text-xs font-bold mb-2">Region:</label>
        <div class="flex gap-1">
          <UButton
            @click="selectedIndex = 0"
            :variant="selectedIndex === 0 ? 'solid' : 'ghost'"
            :color="selectedIndex === 0 ? 'primary' : 'neutral'"
            class="flex-1"
            size="sm"
          >
            UK
          </UButton>
          <UButton
            @click="selectedIndex = 1"
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
        {{ currentData.Main_Headline }}
      </h1>

      <VIPHero 
        v-if="showTacticalHero"
        :imgUrl="currentData.Tactical_Hero_Image_URL" 
        :text="currentData.Tactical_Hero_Copy"
        :ctaUrl="currentData.Tactical_Hero_CTA_URL"
        :ctaText="currentData.Tactical_Hero_CTA_Copy"
        :csvColumns="{
          imgUrl: 'Tactical Hero Image URL',
          text: 'Tactical Hero Copy',
          ctaUrl: 'Tactical Hero CTA URL',
          ctaText: 'Tactical Hero CTA Copy'
        }"
      />
      <VIPHero 
        v-else
        :imgUrl="currentData.Hero_Image_URL" 
        :text="currentData.Hero_Copy"
        :ctaUrl="currentData.Hero_CTA_URL"
        :ctaText="currentData.Hero_CTA_Copy"
        :csvColumns="{
          imgUrl: 'Hero Image URL',
          text: 'Hero Copy',
          ctaUrl: 'Hero CTA URL',
          ctaText: 'Hero CTA Copy'
        }"
      />

      <VIPContent 
        v-if="showSports"
        :headingText="currentData.Sports_Heading"
        :imgUrl="[currentData.Sports_1_Image_URL,currentData.Sports_2_Image_URL,currentData.Sports_3_Image_URL]"
        :text="currentData.Sports_Copy"
        :ctaUrl="currentData.Sports_CTA_URL"
        :ctaText="currentData.Sports_CTA_Copy"
        type="cols"
        :csvColumns="{
          headingText: 'Sports Heading',
          imgUrl: 'Sports Image URLs (1, 2, 3)',
          text: 'Sports Copy',
          ctaUrl: 'Sports CTA URL',
          ctaText: 'Sports CTA Copy'
        }"
      />

      <VIPContent 
        v-if="showRewardsOnRepeat"
        :headingText="currentData.Rewards_on_Repeat_Heading"
        :imgUrl="currentData.Rewards_on_Repeat_Image_URL"
        :text="currentData.Rewards_on_Repeat_Copy"
        :ctaUrl="currentData.Rewards_on_Repeat_CTA_URL"
        :ctaText="currentData.Rewards_on_Repeat_CTA_Copy"
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
        :headingText="currentData.Experience_Heading"
        :imgUrl="[currentData.Experience_1_Image_URL,currentData.Experience_2_Image_URL,currentData.Experience_3_Image_URL]"
        :text="currentData.Experience_Copy"
        :ctaUrl="currentData.Experience_CTA_URL"
        :ctaText="currentData.Experience_CTA_Copy"
        type="cols"
        :csvColumns="{
          headingText: 'Experience Heading',
          imgUrl: 'Experience Image URLs (1, 2, 3)',
          text: 'Experience Copy',
          ctaUrl: 'Experience CTA URL',
          ctaText: 'Experience CTA Copy'
        }"
      />

      <VIPContent 
        v-if="showEverydaySavings"
        :headingText="currentData.Everyday_Savings_Heading"
        :imgUrl="currentData.Everyday_Savings_Image_URL"
        :text="currentData.Everyday_Savings_Copy"
        :ctaUrl="currentData.Everyday_Savings_CTA_URL"
        :ctaText="currentData.Everyday_Savings_CTA_Copy"
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
        :headingText="currentData.TV_Customers_Heading"
        :imgUrl="currentData.TV_Customers_Image_URL"
        :text="currentData.TV_Customers_Copy"
        :ctaUrl="currentData.TV_Customers_CTA_URL"
        :ctaText="currentData.TV_Customers_CTA_Copy"
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
        :headingText="currentData.BB_Customers_Heading"
        :imgUrl="currentData.BB_Customers_Image_URL"
        :text="currentData.BB_Customers_Copy"
        :ctaUrl="currentData.BB_Customers_CTA_URL"
        :ctaText="currentData.BB_Customers_CTA_Copy"
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
        :headingText="currentData.Mobile_Heading"
        :imgUrl="currentData.Mobile_Image_URL"
        :text="currentData.Mobile_Copy"
        :ctaUrl="currentData.Mobile_CTA_URL"
        :ctaText="currentData.Mobile_CTA_Copy"
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
        :headingText="currentData.TV_BB_Heading"
        :imgUrl="currentData.TV_BB_Image_URL"
        :text="currentData.TV_BB_Copy"
        :ctaUrl="currentData.TV_BB_CTA_URL"
        :ctaText="currentData.TV_BB_CTA_Copy"
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
        :headingText="currentData.TV_BB_Mobile_Heading"
        :imgUrl="currentData.TV_BB_Mobile_Image_URL"
        :text="currentData.TV_BB_Mobile_Copy"
        :ctaUrl="currentData.TV_BB_Mobile_CTA_URL"
        :ctaText="currentData.TV_BB_Mobile_CTA_Copy"
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
        :headingText="currentData.TV_Mobile_Heading"
        :imgUrl="currentData.TV_Mobile_Image_URL"
        :text="currentData.TV_Mobile_Copy"
        :ctaUrl="currentData.TV_Mobile_CTA_URL"
        :ctaText="currentData.TV_Mobile_CTA_Copy"
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
        :headingText="currentData.BB_Mobile_Heading"
        :imgUrl="currentData.BB_Mobile_Image_URL"
        :text="currentData.BB_Mobile_Copy"
        :ctaUrl="currentData.BB_Mobile_CTA_URL"
        :ctaText="currentData.BB_Mobile_CTA_Copy"
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
        :headingText="currentData.Extra_Entertainment_Heading"
        :imgUrl="currentData.Extra_Entertainment_Image_URL"
        :text="currentData.Extra_Entertainment_Copy"
        :ctaUrl="currentData.Extra_Entertainment_CTA_URL"
        :ctaText="currentData.Extra_Entertainment_CTA_Copy"
        :csvColumns="{
          headingText: 'Extra Entertainment Heading',
          imgUrl: 'Extra Entertainment Image URL',
          text: 'Extra Entertainment Copy',
          ctaUrl: 'Extra Entertainment CTA URL',
          ctaText: 'Extra Entertainment CTA Copy'
        }"
      />

      <VIPHeading class="mb-12">
        {{ currentData.Signoff_Copy }}
      </VIPHeading>

      <div class="h-[6px] gradient"></div>

      <div>
        <img src="https://res.newsletter.contact.sky/res/img/0990D9D2426E04156EA51E87F3C7235F.png" alt="Sky" class="w-[74px] h-[45px] my-10 mx-auto" />
        <p class="text-[10px] leading-[14px] mb-4 mx-7 font-arial">
          <a href="#" class="underline">Privacy Policy</a> | <a href="#" class="underline">Terms and Conditions</a> | <a href="#" class="underline">Contact us</a> | <a href="#" class="underline">My Account</a>
          <br><br>
          You were sent this email as part of your Sky VIP membership.<br>
          If you do not want to continue to receive these newsletters please <a href="#" class="underline">click on this link</a>.
          <br><br>
          Please do not reply to this email as this address is not&nbsp;monitored.
          <template v-if="currentData.Legal_Copy">
            <br><br>
            {{ currentData.Legal_Copy }}
          </template>
          <template v-if="currentData.Legal_Copy_Extra">
            <br><br>
            {{ currentData.Legal_Copy_Extra }}
          </template>
          <br><br>
          &#169; 2025 Sky UK Ltd. Sky UK Ltd (company no. 02906991) has its registered office at Grant Way, Isleworth, Middlesex&nbsp;TW7&nbsp;5QD.
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