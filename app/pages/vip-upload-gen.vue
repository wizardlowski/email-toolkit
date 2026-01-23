<script setup lang="ts">
useHead({
  title: 'VIP Upload Gen'
})

definePageMeta({
  name: 'VIP Upload Gen'
})

const files = ref<File[]>([])
const generatedHtml = ref('')

function handleFiles(newFiles: File[]) {
  const imageFiles = newFiles.filter(file => file.type.startsWith('image/'))
  if (imageFiles.length === 0) return

  files.value = imageFiles
  const divs = imageFiles
    .map(file => {
      const name = file.name.replace(/\.[^.]+$/, '')
      return `<div><img src="images/${file.name}" alt="${name}"></div>`
    })
    .join('\n')
  generatedHtml.value = `<html>\n<body>\n${divs}\n</body>\n</html>`
}

function downloadHtml() {
  const blob = new Blob([generatedHtml.value], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'vip-upload.html'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function reset() {
  files.value = []
  generatedHtml.value = ''
}
</script>

<template>
  <div class="p-4 min-h-full">
    <div v-if="generatedHtml">
      <div class="flex justify-end gap-4 mb-2">
        <UButton color="primary" @click="downloadHtml">
          Save HTML
        </UButton>
        <UButton color="primary" @click="reset">
          Reset
        </UButton>
      </div>
      <pre class="p-4 rounded bg-neutral-100 dark:bg-neutral-800 overflow-x-auto text-sm">{{ generatedHtml }}</pre>
    </div>

    <FileDropZone
      v-else
      accept="image/*"
      :multiple="true"
      icon="image"
      title="Drag and drop images here"
      button-text="Choose Files"
      @drop="handleFiles"
      @input="handleFiles"
      class="mb-6"
    />

  </div>
</template>
