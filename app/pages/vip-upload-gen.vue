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
</script>

<template>
  <div class="p-4 min-h-full">
    <FileDropZone
      accept="image/*"
      :multiple="true"
      icon="image"
      title="Drag and drop images here"
      button-text="Choose Files"
      @drop="handleFiles"
      @input="handleFiles"
      class="mb-6"
    />

    <div v-if="generatedHtml">
      <div class="flex justify-end mb-2">
        <UButton color="primary" @click="downloadHtml">
          Save HTML
        </UButton>
      </div>
      <pre class="p-4 rounded bg-neutral-100 dark:bg-neutral-800 overflow-x-auto text-sm">{{ generatedHtml }}</pre>
    </div>
  </div>
</template>
