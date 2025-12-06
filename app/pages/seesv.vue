<script setup lang="ts">
import Papa from 'papaparse'

useHead({
  title: 'Seesv'
})

definePageMeta({
  name: 'Seesv'
})

interface CSVRow {
  label: string
  column2: string
  column3: string
}

const csvFile = ref<File | null>(null)
const fileOpened = ref(false)
const errorMessage = ref('')
const csvData = ref<CSVRow[]>([])

function handleImageError(event: Event) {
  const target = event.target as HTMLImageElement
  target.style.display = 'none'
}

function handleImageLoad(event: Event) {
  const target = event.target as HTMLImageElement  
  target.style.display = 'block'
}

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
    const text = await file.text()
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
      header: false,
      skipEmptyLines: true,
      transform: (value: string) => value.trim()
    })
    
    if (result.errors.length > 0) {
      console.warn('CSV parsing errors:', result.errors)
    }
    
    const rows: CSVRow[] = []
    
    const dataArrays = result.data as string[][]
    if (dataArrays.length === 0) {
      return
    }
    
    const headers = dataArrays[0]
    if (!headers) {
      return
    }
    
    // Create a row for each header/label
    for (let colIndex = 0; colIndex < headers.length; colIndex++) {
      const label = headers[colIndex] ?? `Column ${colIndex + 1}`
      
      rows.push({
        label: label,
        column2: dataArrays[1] ? (dataArrays[1][colIndex] || '') : '',
        column3: dataArrays[2] ? (dataArrays[2][colIndex] || '') : ''
      })
    }
    
    csvData.value = rows
  } catch (error) {
    console.error('Error parsing CSV:', error)
    errorMessage.value = 'Error: Failed to parse CSV file'
  }
}

function clearAll() {
  if (csvData.value.length > 0) {
    const confirmed = confirm('Are you sure you want to clear all data? Any unsaved changes will be lost.')
    if (!confirmed) {
      return
    }
  }
  
  csvFile.value = null
  fileOpened.value = false
  errorMessage.value = ''
  csvData.value = []
}

function isImageUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false
  
  const imageExtensions = /\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i
  const isHttpUrl = /^https?:\/\/.+/i.test(url)
  
  return isHttpUrl && (
    imageExtensions.test(url) ||
    url.includes('movableink') ||
    url.includes('images') ||
    url.includes('img') ||
    url.includes('media') ||
    url.includes('assets')
  )
}

function downloadCSV() {
  if (!csvFile.value || csvData.value.length === 0) return

  // Transform the data back to CSV format
  const csvRows: string[][] = []

  const headerRow = csvData.value.map(row => row.label)
  csvRows.push(headerRow)

  const dataRow1 = csvData.value.map(row => row.column2)
  const dataRow2 = csvData.value.map(row => row.column3)

  csvRows.push(dataRow1)
  csvRows.push(dataRow2)


  const csvString = Papa.unparse(csvRows)

  // Add UTF-8 BOM to ensure proper encoding recognition
  const blob = new Blob(['\uFEFF' + csvString], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = csvFile.value.name
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="p-4 min-h-full">
    <div class="mb-6">
      <div class="flex justify-center gap-4 mb-4">
        <UButton @click="clearAll" :disabled="!csvFile">
          Clear All
        </UButton>
        <UButton @click="downloadCSV" :disabled="!csvFile || csvData.length === 0" color="primary">
          Download
        </UButton>
      </div>
    </div>

    <FileDropZone 
      v-if="!fileOpened"
      accept=".csv,text/csv" 
      title="Drag and drop CSV file here"
      button-text="Choose CSV File"
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


    <div v-if="csvData.length > 0" class="space-y-4">
      <div 
        v-for="(row, index) in csvData" 
        :key="index"
        class="grid grid-cols-[300px_1fr_1fr] gap-4 items-start p-4 border rounded-lg dark:border-gray-600"
      >
        <!-- Label (First Column) -->
        <div class="flex items-center">
          <h3 class="text-lg font-bold text-gray-900 dark:text-white break-words">
            {{ row.label }}
          </h3>
        </div>
        
        <div>
          <div v-if="isImageUrl(row.column2)" class="mb-2 flex justify-center">
            <img 
              :src="row.column2" 
              :alt="'Preview for ' + row.label"
              class="max-w-xs h-auto max-h-32 object-contain rounded"
              @error="handleImageError"
              @load="handleImageLoad"
            />
          </div>
          <UTextarea 
            v-model="row.column2" 
            :rows="3"
            placeholder="Column 2 value"
            class="w-full"
            spellcheck="true"
          />
        </div>
        
        <div>
          <div v-if="isImageUrl(row.column3)" class="mb-2 flex justify-center">
            <img 
              :src="row.column3" 
              :alt="'Preview for ' + row.label"
              class="max-w-xs h-auto max-h-32 object-contain rounded"
              @error="handleImageError"
              @load="handleImageLoad"
            />
          </div>
          <UTextarea 
            v-model="row.column3" 
            :rows="3"
            placeholder="Column 3 value"
            class="w-full"
            spellcheck="true"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped></style>