<script lang="ts" setup>
useHead({ title: 'Get Store Movies' })
definePageMeta({
  name: 'Get Store Movies'
})

const output = ref('')
const loading = ref(false)
const copied = ref(false)

async function fetchMovies() {
  loading.value = true
  try {
    const response = await $fetch('/api/store-movies') as any
    const items = (response as any).content.assets.slice(0, 4)
    const result: Record<string, string> = {}

    items.forEach((item: any, i: number) => {
      const n = i + 1
      result[`title${n}`] = item.title
      const imageLink = item.links?.find((l: any) => l.rel === 'image')
      if (imageLink) result[`image${n}`] = imageLink.href.split('?')[0]
      const selfLink = item.links?.find((l: any) => l.rel === 'self')
      if (selfLink) result[`link${n}`] = selfLink.href
    })

    output.value = JSON.stringify(result, null, 2)
  } catch (e: any) {
    output.value = `Error: ${e.message}`
  } finally {
    loading.value = false
  }
}

async function copyOutput() {
  await navigator.clipboard.writeText(output.value)
  copied.value = true
  setTimeout(() => copied.value = false, 2000)
}
</script>

<template>
  <div class="max-w-3xl mx-auto p-4 space-y-4">
    <UButton :loading="loading" @click="fetchMovies">Fetch Movies</UButton>

    <div v-if="output" class="space-y-2">
      <UButton variant="outline" size="sm" @click="copyOutput">
        {{ copied ? 'Copied!' : 'Copy' }}
      </UButton>
      <pre class="bg-gray-100 dark:bg-gray-800 p-4 rounded text-sm overflow-auto whitespace-pre-wrap">{{ output }}</pre>
    </div>
  </div>
</template>
