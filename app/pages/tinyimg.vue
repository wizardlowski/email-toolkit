<script setup lang="ts">
import imageCompression from 'browser-image-compression'
import JSZip from 'jszip'

useHead({
  title: 'TinyImg - Image Compressor'
})

definePageMeta({
  name: 'TinyImg'
})

interface CompressedImage {
  id: string
  originalFile: File
  compressedFile: File | null
  originalSize: number
  compressedSize: number
  compressionRatio: number
  status: 'pending' | 'compressing' | 'completed' | 'error'
  error?: string
}

const images = ref<CompressedImage[]>([])
const isProcessing = ref(false)
const compressionOptions = ref({
  maxSizeMB: 0.5,
  maxWidthOrHeight: 1920,
  useWebWorker: true,
  quality: 0.7,
  alwaysKeepResolution: true
})

async function handleDropZoneFiles(files: File[]) {
  const imageFiles = files.filter(file => file.type.startsWith('image/'))
  
  if (imageFiles.length === 0) {
    return
  }

  await processImages(imageFiles)
}

async function processImages(files: File[]) {
  isProcessing.value = true
  
  const newImages: CompressedImage[] = files.map(file => ({
    id: crypto.randomUUID(),
    originalFile: file,
    compressedFile: null,
    originalSize: file.size,
    compressedSize: 0,
    compressionRatio: 0,
    status: 'pending'
  }))

  images.value.push(...newImages)

  for (const image of newImages) {
    image.status = 'compressing'
    
    try {
      const compressedFile = await imageCompression(image.originalFile, compressionOptions.value)
      
      image.compressedFile = compressedFile
      image.compressedSize = compressedFile.size
      image.compressionRatio = Math.round(((image.originalSize - compressedFile.size) / image.originalSize) * 100)
      image.status = 'completed'
    } catch (error) {
      image.status = 'error'
      image.error = error instanceof Error ? error.message : 'Compression failed'
    }
  }
  
  isProcessing.value = false
}

function downloadImage(image: CompressedImage) {
  if (!image.compressedFile) return
  
  const url = URL.createObjectURL(image.compressedFile)
  const a = document.createElement('a')
  a.href = url
  a.download = `compressed_${image.originalFile.name}`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

async function downloadAll() {
  const completedImages = images.value.filter(img => img.status === 'completed' && img.compressedFile)
  
  if (completedImages.length === 0) return
  
  const zip = new JSZip()
  
  for (const image of completedImages) {
    if (image.compressedFile) {
      zip.file(`compressed_${image.originalFile.name}`, image.compressedFile)
    }
  }
  
  const content = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(content)
  const a = document.createElement('a')
  a.href = url
  a.download = 'compressed_images.zip'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function clearAll() {
  images.value = []
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function removeImage(imageId: string) {
  images.value = images.value.filter(img => img.id !== imageId)
}
</script>

<template>
  <div class="p-4 min-h-full">
    <div class="mb-6">
      <div class="flex justify-center gap-4 mb-4">
        <UButton @click="clearAll" :disabled="images.length === 0">
          Clear All
        </UButton>
        <UButton 
          @click="downloadAll" 
          :disabled="!images.some(img => img.status === 'completed')"
          color="primary"
        >
          Download All as ZIP
        </UButton>
      </div>

    </div>

    <FileDropZone 
      accept="image/*" 
      :multiple="true"
      icon="image"
      title="Drag and drop images here"
      button-text="Choose Files"
      @drop="handleDropZoneFiles"
      @input="handleDropZoneFiles"
      class="mb-6"
    />

    <div v-if="isProcessing" class="text-center mb-6">
      <div class="inline-flex items-center">
        <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-primary-600" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        Processing images...
      </div>
    </div>

    <div v-if="images.length > 0" class="space-y-4">
      <div 
        v-for="image in images" 
        :key="image.id"
        class="border rounded-lg p-4 dark:border-neutral-600"
      >
        <div class="flex items-center justify-between">
          <div class="flex-1">
            <div class="font-medium">{{ image.originalFile.name }}</div>
            <div class="text-sm text-neutral-500">
              {{ formatFileSize(image.originalSize) }}
              <span v-if="image.status === 'completed'">
                → {{ formatFileSize(image.compressedSize) }}
                <span class="text-green-600 font-medium">({{ image.compressionRatio }}% smaller)</span>
              </span>
            </div>
            
            <div class="mt-2">
              <span 
                v-if="image.status === 'pending'" 
                class="inline-flex items-center px-2 py-1 rounded-full text-xs bg-neutral-100 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-300"
              >
                Pending
              </span>
              <span 
                v-else-if="image.status === 'compressing'" 
                class="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300"
              >
                <svg class="animate-spin -ml-1 mr-1 h-3 w-3" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Compressing
              </span>
              <span 
                v-else-if="image.status === 'completed'" 
                class="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
              >
                Completed
              </span>
              <span 
                v-else-if="image.status === 'error'" 
                class="inline-flex items-center px-2 py-1 rounded-full text-xs bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"
                :title="image.error"
              >
                Error
              </span>
            </div>
          </div>
          
          <div class="flex gap-2">
            <UButton 
              v-if="image.status === 'completed'"
              @click="downloadImage(image)"
              size="sm"
              color="primary"
            >
              Download
            </UButton>
            <UButton 
              @click="removeImage(image.id)"
              size="sm"
              color="red"
              variant="ghost"
            >
              Remove
            </UButton>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>