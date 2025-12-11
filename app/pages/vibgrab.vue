<script setup lang="ts">
useHead({
  title: 'Vibgrab'
})
definePageMeta({
  name: 'Vibgrab'
})

interface ProcessedFile {
  file: File
  identifier: string
  browserViewUrl: string
  finalUrl: string
  isLoadingRedirect: boolean
}

const emlFiles = ref<File[]>([])
const processedFiles = ref<ProcessedFile[]>([])
const fileOpened = ref(false)
const errorMessage = ref('')
const isProcessing = ref(false)

async function handleDropZoneFiles(files: File[]) {
  if (files.length === 0) {
    return
  }

  processFiles(files).catch(err => {
    console.error('Error processing files:', err)
    errorMessage.value = 'Error processing files'
  })
}

async function processFiles(files: File[]) {
  errorMessage.value = ''
  isProcessing.value = true
  
  const validFiles: File[] = []
  
  for (const file of files) {
    const fileExtension = file.name.split('.').pop()?.toLowerCase()
    const isEML = fileExtension === 'eml'
    
    if (!isEML) {
      errorMessage.value = `Error: ${file.name} is not a .eml file. Please select .eml files only.`
      continue
    }
    
    validFiles.push(file)
  }

  if (validFiles.length === 0) {
    fileOpened.value = false
    emlFiles.value = []
    processedFiles.value = []
    isProcessing.value = false
    return
  }

  try {
    emlFiles.value = validFiles
    const processed: ProcessedFile[] = []
    
    // First pass: extract file info and URLs immediately
    for (const file of validFiles) {
      const identifier = extractIdentifier(file.name)
      const browserViewUrl = await extractBrowserViewUrl(file)
      
      processed.push({
        file,
        identifier,
        browserViewUrl,
        finalUrl: '',
        isLoadingRedirect: browserViewUrl ? true : false
      })
    }
    
    // Show the files immediately
    processedFiles.value = processed
    fileOpened.value = true
    
    // Second pass: resolve redirects asynchronously
    for (let i = 0; i < processed.length; i++) {
      const processedFile = processed[i]
      if (processedFile && processedFile.browserViewUrl) {
        // Start redirect resolution in background
        followRedirect(processedFile.browserViewUrl).then((finalUrl: string) => {
          // Update the specific file's redirect info
          const targetFile = processedFiles.value[i]
          if (targetFile) {
            targetFile.finalUrl = finalUrl
            targetFile.isLoadingRedirect = false
          }
        }).catch((error: unknown) => {
          console.error('Error resolving redirect:', error)
          const targetFile = processedFiles.value[i]
          if (targetFile && processedFile) {
            targetFile.finalUrl = processedFile.browserViewUrl // Fallback to original
            targetFile.isLoadingRedirect = false
          }
        })
      }
    }
  } catch (error: unknown) {
    console.error('Error processing files:', error)
    errorMessage.value = 'Error: Failed to process .eml files'
    fileOpened.value = false
    emlFiles.value = []
    processedFiles.value = []
  } finally {
    isProcessing.value = false
  }
}

function extractIdentifier(filename: string): string {
  const firstBracket = filename.indexOf('[')
  if (firstBracket === -1) return ''
  
  const beforeMultipart = filename.indexOf(' 1 multipart')
  if (beforeMultipart === -1) return ''
  
  return filename.substring(firstBracket + 1, beforeMultipart)
}

async function extractBrowserViewUrl(file: File): Promise<string> {
  try {
    const text = await file.text()
    
    const regex = /<a href=3D"([^"]*?)"[^>]*>.*?View email in browser.*?<\/a>/gi
    const match = regex.exec(text)
    
    if (match && match[1]) {
      let url = match[1]
      url = url.replace(/=3D/g, '=').replace(/=\r?\n/g, '')
      return url
    }
    
    return ''
  } catch (error: unknown) {
    console.error('💥 Error extracting browser view URL:', error)
    return ''
  }
}

async function followRedirect(url: string): Promise<string> {
  try {
    // Call serverless function to handle redirect following
    const response = await $fetch<{ finalUrl?: string }>('/api/vibRedirect', {
      method: 'POST',
      body: { url }
    })
    
    return response.finalUrl || url
    
  } catch (error: unknown) {
    console.error('Error following redirect:', error)
    return url // Return original URL if redirect fails
  }
}

const { copy } = useClipboard()
const copyBtnText = ref('Copy All')

function copyAllResults() {
  const results = processedFiles.value
    .filter(file => file.identifier || file.finalUrl)
    .map(file => `${file.identifier || 'N/A'}\n${file.finalUrl || file.browserViewUrl || 'N/A'}`)
    .join('\n\n')
  
  copy(results)
  copyBtnText.value = 'Copied!'
  
  setTimeout(() => {
    copyBtnText.value = 'Copy All'
  }, 2000)
}

function clearAll() {
  emlFiles.value = []
  processedFiles.value = []
  fileOpened.value = false
  errorMessage.value = ''
}

</script>

<template>
  <div class="p-4 min-h-full">
    <div class="mb-6">
      <div class="flex justify-center gap-4 mb-4">
        <UButton @click="clearAll" :disabled="!fileOpened">
          Clear All
        </UButton>
      </div>
    </div>

    <FileDropZone 
      v-if="!fileOpened"
      accept=".eml" 
      :multiple="true"
      icon="email"
      title="Drag and drop .eml files here"
      button-text="Choose .eml Files"
      @drop="handleDropZoneFiles"
      @input="handleDropZoneFiles"
      class="mb-6"
    />

    <UAlert v-if="errorMessage" color="error" variant="soft" :title="errorMessage" icon="i-lucide-circle-alert" class="mb-6" />

    <div v-if="isProcessing" class="text-center py-8">
      <UBadge color="info" variant="subtle" size="lg" icon="i-lucide-loader-circle" class="[&>svg]:animate-spin">
        Processing email files...
      </UBadge>
    </div>

    <div v-if="processedFiles.length > 0" class="space-y-6">
      <div class="flex justify-between items-center">
        <h2 class="text-xl font-semibold">Results ({{ processedFiles.length }})</h2>
        <UButton @click="copyAllResults">
          {{ copyBtnText }}
        </UButton>
      </div>
      
      <UCard variant="soft">
        <div v-for="(processedFile, index) in processedFiles" :key="index" class="mb-4 last:mb-0">
          <div class="font-mono text-sm space-y-1">
            <div>{{ processedFile.identifier || 'N/A' }}</div>
            <div v-if="processedFile.isLoadingRedirect" class="text-neutral-500 italic">
              Getting vib...
            </div>
            <div v-else class="break-all">
              {{ processedFile.finalUrl || processedFile.browserViewUrl || 'N/A' }}
            </div>
          </div>
          <USeparator v-if="index < processedFiles.length - 1" class="mt-4" />
        </div>
      </UCard>
    </div>
  </div>
</template>