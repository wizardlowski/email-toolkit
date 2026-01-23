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
  values: string[]
}

const csvFile = ref<File | null>(null)
const fileOpened = ref(false)
const errorMessage = ref('')
const csvData = ref<CSVRow[]>([])
const hiddenColumns = ref<CSVRow[]>([])
const regions = ref<string[]>([])
const columnCount = ref(0)
const collapsedRows = ref<Set<number>>(new Set())

// Add Images modal state
const showAddImagesModal = ref(false)
const addImagesPasteContent = ref('')

const toast = useToast()

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

    const dataArrays = result.data as string[][]
    if (dataArrays.length === 0) {
      return
    }

    const headers = dataArrays[0]
    if (!headers) {
      return
    }

    const dataRowCount = dataArrays.length - 1
    columnCount.value = dataRowCount

    // Filter out data rows that are entirely empty
    const nonEmptyRowIndices: number[] = []
    for (let rowIndex = 1; rowIndex <= dataRowCount; rowIndex++) {
      const rowData = dataArrays[rowIndex]
      if (rowData && rowData.some(v => v !== '')) {
        nonEmptyRowIndices.push(rowIndex)
      }
    }

    columnCount.value = nonEmptyRowIndices.length

    const hiddenLabels = ['region', 'currency_code']
    const rows: CSVRow[] = []
    const hidden: CSVRow[] = []

    for (let colIndex = 0; colIndex < headers.length; colIndex++) {
      const label = headers[colIndex] ?? `Column ${colIndex + 1}`
      const values = nonEmptyRowIndices.map(i => dataArrays[i]?.[colIndex] || '')
      const entry = { label, values }

      if (hiddenLabels.includes(label.toLowerCase())) {
        hidden.push(entry)
      } else {
        rows.push(entry)
      }
    }

    // Extract region values for row labels
    const regionCol = hidden.find(c => c.label.toLowerCase() === 'region')
    regions.value = regionCol ? regionCol.values : []

    hiddenColumns.value = hidden
    csvData.value = rows.filter(row => !row.values.every(v => v === ''))
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
  hiddenColumns.value = []
  regions.value = []
  columnCount.value = 0
  collapsedRows.value = new Set()
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

  const csvRows: string[][] = []
  const allColumns = [...hiddenColumns.value, ...csvData.value]

  const headerRow = allColumns.map(row => row.label)
  csvRows.push(headerRow)

  for (let i = 0; i < columnCount.value; i++) {
    const dataRow = allColumns.map(row => row.values[i] || '')
    csvRows.push(dataRow)
  }

  const csvString = Papa.unparse(csvRows)

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

// --- Add Images logic ---

function normalizeLabel(label: string): string {
  return label.toLowerCase()
}

function normalizeLabelStripS(label: string): string {
  return label.toLowerCase().split('_').map(seg => seg.replace(/s$/, '')).join('_')
}

function findMatchingRow(columnName: string): CSVRow | null {
  // Direct match
  const direct = csvData.value.find(r => r.label === columnName)
  if (direct) return direct

  // Case-insensitive
  const lower = normalizeLabel(columnName)
  const ciMatch = csvData.value.find(r => normalizeLabel(r.label) === lower)
  if (ciMatch) return ciMatch

  // Strip trailing 's' from segments
  const stripped = normalizeLabelStripS(columnName)
  const stripMatch = csvData.value.find(r => normalizeLabelStripS(r.label) === stripped)
  if (stripMatch) return stripMatch

  return null
}

interface ParsedMapping {
  columnName: string
  path: string
}

function parsePasteContent(content: string): ParsedMapping[] {
  const mappings: ParsedMapping[] = []

  if (content.includes('<img')) {
    // HTML format
    const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]+alt=["']([^"']+)["']|<img[^>]+alt=["']([^"']+)["'][^>]+src=["']([^"']+)["']/gi
    let match
    while ((match = imgRegex.exec(content)) !== null) {
      const src = match[1] || match[4] || ''
      let alt = match[2] || match[3] || ''
      // Strip file extension from alt text
      alt = alt.replace(/\.(png|jpe?g|gif|bmp|webp|svg)$/i, '')
      if (src && alt) {
        mappings.push({ columnName: alt.trim(), path: src.trim() })
      }
    }
  } else {
    // Text format - lines like: "23/01/2026 13:09:39    Column_Name:https://..."
    const lines = content.split('\n')
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue

      // Strip leading timestamp (DD/MM/YYYY HH:MM:SS or YYYY-MM-DD HH:MM:SS + whitespace)
      const withoutTimestamp = trimmed
        .replace(/^\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2}\s+/, '')
        .replace(/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\s+/, '')

      if (!withoutTimestamp.includes(':')) continue

      const colonIndex = withoutTimestamp.indexOf(':')
      const columnName = withoutTimestamp.substring(0, colonIndex).trim()
      const path = withoutTimestamp.substring(colonIndex + 1).trim()

      if (columnName && path) {
        mappings.push({ columnName, path })
      }
    }
  }

  return mappings
}

function applyAddImages() {
  const mappings = parsePasteContent(addImagesPasteContent.value)
  if (mappings.length === 0) {
    toast.add({ title: 'No mappings found in pasted content', color: 'warning' })
    return
  }

  const unmatched: string[] = []

  for (const { columnName, path } of mappings) {
    const row = findMatchingRow(columnName)
    if (row) {
      for (let i = 0; i < row.values.length; i++) {
        row.values[i] = path
      }
    } else {
      unmatched.push(columnName)
    }
  }

  if (unmatched.length > 0) {
    toast.add({
      title: `${unmatched.length} unmatched column(s): ${unmatched.join(', ')}`,
      color: 'warning'
    })
  }

  addImagesPasteContent.value = ''
  showAddImagesModal.value = false
}

function toggleRow(index: number) {
  const s = collapsedRows.value
  if (s.has(index)) {
    s.delete(index)
  } else {
    s.add(index)
  }
  collapsedRows.value = new Set(s)
}

function collapseEmpty() {
  const s = new Set(collapsedRows.value)
  csvData.value.forEach((row, index) => {
    if (row.values.every(v => v === '')) {
      s.add(index)
    }
  })
  collapsedRows.value = s
}

const gridClass = computed(() => {
  const cols = columnCount.value || 1
  return `p-4 sm:p-4 grid grid-cols-[300px_repeat(${cols},1fr)] gap-4 items-start`
})
</script>

<template>
  <div class="p-4 min-h-full">
    <div class="mb-6">
      <div class="flex justify-center gap-4 mb-4">
        <UButton @click="clearAll" :disabled="!csvFile">
          Clear All
        </UButton>
        <UButton @click="collapseEmpty" :disabled="!csvFile || csvData.length === 0">
          Collapse Empty
        </UButton>
        <UButton @click="showAddImagesModal = true" :disabled="!csvFile || csvData.length === 0">
          Add Images
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

    <UAlert v-if="errorMessage" color="error" variant="soft" :title="errorMessage" icon="i-lucide-circle-alert" class="mb-6" />

    <div v-if="csvData.length > 0" class="space-y-4">
      <UCard
        v-for="(row, index) in csvData"
        :key="index"
        :ui="{ body: gridClass }"
      >
        <!-- Label -->
        <div class="flex items-center cursor-pointer select-none" @click="toggleRow(index)">
          <UIcon :name="collapsedRows.has(index) ? 'i-lucide-chevron-right' : 'i-lucide-chevron-down'" class="mr-2 shrink-0" />
          <h3 class="text-lg font-bold text-neutral-900 dark:text-white break-words">
            {{ row.label }}
          </h3>
        </div>

        <!-- Dynamic value columns -->
        <div v-show="!collapsedRows.has(index)" :class="columnCount > 1 ? 'grid grid-cols-2 gap-4' : ''">
          <div v-for="(val, vIndex) in row.values" :key="vIndex">
            <p v-if="columnCount > 1 && regions[vIndex]" class="text-xs font-semibold text-neutral-500 dark:text-neutral-400 mb-1">{{ regions[vIndex] }}</p>
            <div v-if="isImageUrl(val)" class="mb-2 flex justify-center">
              <img
                :src="val"
                :alt="'Preview for ' + row.label"
                class="max-w-xs h-auto max-h-32 object-contain rounded"
                @error="handleImageError"
                @load="handleImageLoad"
              />
            </div>
            <UTextarea
              v-model="row.values[vIndex]"
              :rows="3"
              :placeholder="`Value ${vIndex + 1}`"
              class="w-full"
              spellcheck="true"
            />
          </div>
        </div>
      </UCard>
    </div>

    <!-- Add Images Modal -->
    <UModal v-model:open="showAddImagesModal">
      <template #content>
        <div class="p-6">
          <h3 class="text-lg font-semibold mb-4">Add Images</h3>
          <p class="text-sm text-neutral-500 dark:text-neutral-400 mb-3">
            Paste HTML img tags or text with column_name: url format
          </p>
          <UTextarea
            v-model="addImagesPasteContent"
            :rows="10"
            placeholder="<img src=&quot;https://...&quot; alt=&quot;Column_Name&quot;>&#10;or&#10;Column_Name: https://..."
            class="w-full mb-4"
          />
          <div class="flex justify-end gap-2">
            <UButton variant="ghost" @click="showAddImagesModal = false">Cancel</UButton>
            <UButton color="primary" @click="applyAddImages" :disabled="!addImagesPasteContent.trim()">Submit</UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

<style scoped></style>
