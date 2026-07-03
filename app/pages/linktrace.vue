<script setup lang="ts">
useHead({
  title: 'LinkTrace'
})
definePageMeta({
  name: 'LinkTrace'
})

interface Hop {
  url: string
  status: number
  statusText: string
}

interface TraceResult {
  hops: Hop[]
  finalUrl: string
  error?: string
}

const inputUrl = ref('')
const hops = ref<Hop[]>([])
const finalUrl = ref('')
const traceWarning = ref('')
const errorMessage = ref('')
const isTracing = ref(false)
const hasResult = ref(false)

async function trace() {
  const url = inputUrl.value.trim()
  if (!url || isTracing.value) return

  isTracing.value = true
  errorMessage.value = ''
  traceWarning.value = ''
  hops.value = []
  finalUrl.value = ''
  hasResult.value = false

  try {
    const result = await $fetch<TraceResult>('/api/traceRedirects', {
      method: 'POST',
      body: { url }
    })

    hops.value = result.hops
    finalUrl.value = result.finalUrl
    traceWarning.value = result.error || ''
    hasResult.value = true
  } catch (error: unknown) {
    console.error('Error tracing URL:', error)
    const fetchError = error as { data?: { message?: string } }
    errorMessage.value = fetchError?.data?.message || 'Error: failed to trace URL'
  } finally {
    isTracing.value = false
  }
}

function statusColor(status: number) {
  if (status >= 200 && status < 300) return 'success'
  if (status === 301 || status === 308) return 'warning'
  if (status >= 300 && status < 400) return 'info'
  return 'error'
}

const redirectCount = computed(() => Math.max(hops.value.length - 1, 0))

const { copy } = useClipboard()
const copyBtnText = ref('Copy Final URL')

function copyFinalUrl() {
  copy(finalUrl.value)
  copyBtnText.value = 'Copied!'

  setTimeout(() => {
    copyBtnText.value = 'Copy Final URL'
  }, 2000)
}

function clearAll() {
  inputUrl.value = ''
  hops.value = []
  finalUrl.value = ''
  traceWarning.value = ''
  errorMessage.value = ''
  hasResult.value = false
}
</script>

<template>
  <div class="p-4 min-h-full">
    <div class="max-w-3xl mx-auto space-y-6">
      <div class="flex gap-4">
        <UInput
          v-model="inputUrl"
          placeholder="Paste a URL to trace..."
          icon="i-lucide-link"
          class="flex-1"
          @keyup.enter="trace"
        />
        <UButton @click="trace" :disabled="!inputUrl.trim() || isTracing">
          Trace
        </UButton>
        <UButton @click="clearAll" variant="outline" :disabled="!inputUrl && !hasResult">
          Clear
        </UButton>
      </div>

      <UAlert v-if="errorMessage" color="error" variant="soft" :title="errorMessage" icon="i-lucide-circle-alert" />

      <div v-if="isTracing" class="text-center py-8">
        <UBadge color="info" variant="subtle" size="lg" icon="i-lucide-loader-circle" class="[&>svg]:animate-spin">
          Tracing redirects...
        </UBadge>
      </div>

      <div v-if="hasResult" class="space-y-6">
        <UAlert v-if="traceWarning" color="warning" variant="soft" :title="traceWarning" icon="i-lucide-triangle-alert" />

        <div class="flex justify-between items-center">
          <h2 class="text-xl font-semibold">
            {{ redirectCount === 0 ? 'No redirects' : `${redirectCount} redirect${redirectCount === 1 ? '' : 's'}` }}
          </h2>
          <UButton @click="copyFinalUrl" :disabled="!finalUrl">
            {{ copyBtnText }}
          </UButton>
        </div>

        <UCard variant="soft">
          <div v-for="(hop, index) in hops" :key="index">
            <div class="flex items-start gap-3 font-mono text-sm">
              <UBadge :color="statusColor(hop.status)" variant="subtle" class="shrink-0">
                {{ hop.status }}
              </UBadge>
              <span class="break-all" :class="index === hops.length - 1 ? 'font-semibold' : ''">
                {{ hop.url }}
              </span>
            </div>
            <div v-if="index < hops.length - 1" class="py-2 pl-1 text-neutral-400 dark:text-neutral-500">
              <UIcon name="i-lucide-arrow-down" />
            </div>
          </div>
        </UCard>

        <UCard variant="soft">
          <div class="space-y-1">
            <div class="text-sm text-neutral-500 dark:text-neutral-400">Final destination</div>
            <div class="font-mono text-sm break-all font-semibold">{{ finalUrl }}</div>
          </div>
        </UCard>
      </div>
    </div>
  </div>
</template>
