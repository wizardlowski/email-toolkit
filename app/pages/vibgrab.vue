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

    <div v-if="errorMessage" class="text-center mb-6">
      <div class="inline-flex items-center px-4 py-2 rounded-lg bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">
        <svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
        </svg>
        {{ errorMessage }}
      </div>
    </div>

    <div v-if="isProcessing" class="text-center py-8">
      <div class="inline-flex items-center px-4 py-2 rounded-lg bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
        <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        Processing email files...
      </div>
    </div>

    <div v-if="processedFiles.length > 0" class="space-y-6">
      <div class="flex justify-between items-center">
        <h2 class="text-xl font-semibold">Results ({{ processedFiles.length }})</h2>
        <UButton @click="copyAllResults">
          {{ copyBtnText }}
        </UButton>
      </div>
      
      <div class="bg-neutral-50 dark:bg-neutral-800 rounded-lg p-4">
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
          <div v-if="index < processedFiles.length - 1" class="border-b border-neutral-200 dark:border-neutral-600 mt-4"></div>
        </div>
      </div>
    </div>
  </div>
</template>