<script lang="ts" setup>
// @ts-ignore
import ejs from 'ejs'

import { expandTemplate } from '~/util/logik-expand'
import { classifyEjsError, type RenderError } from '~/util/ejs-error'
import { buildAssetMap, rewriteAssetUrls, type AssetMap } from '~/util/spotlight-assets'
import type { DroppedFile } from '~/util/folder-drop'

useHead({
  title: 'Spotlight Preview'
})
definePageMeta({
  name: 'Spotlight Preview'
})

type CustomerType = 'Plus' | 'Q' | 'SOIP_UTV' | 'SOIP_ETV' | 'Staff'

const customerTypes: { value: CustomerType, label: string }[] = [
  { value: 'Plus', label: 'Sky+' },
  { value: 'Q', label: 'Sky Q' },
  { value: 'SOIP_UTV', label: 'SOIP UTV' },
  { value: 'SOIP_ETV', label: 'SOIP ETV' },
  { value: 'Staff', label: 'Staff' },
]

const addonFields = ['Cinema', 'Sports', 'Kids', 'Netflix', 'Disney', 'HBO_Max'] as const
type AddonField = typeof addonFields[number]

const customerType = ref<CustomerType>('SOIP_UTV')
const addons = reactive(
  Object.fromEntries(addonFields.map(f => [f, false])) as Record<AddonField, boolean>
)
// Subject line variant — the template reads it as variables.transition
const transition = ref('A')
const region = ref('GBP')
const vipTier = ref('Gold')
const vipTenureStart = ref('01/01/2018')

function buildSpotlightContext() {
  const type = customerType.value
  const firstName = region.value === 'GBP' ? 'Joe' : 'Jane'
  const surname = region.value === 'GBP' ? 'Bloggs' : 'Doe'

  const targetData: Record<string, string> = {
    // Mutually exclusive — driven by the customer type buttons
    Plus_Customer: type === 'Plus' ? 'Y' : 'N',
    Q_Customer: type === 'Q' ? 'Y' : 'N',
    SOIP_Customer: type === 'SOIP_UTV' || type === 'Staff' ? 'Y' : 'N',
    SOIP_Repack: type === 'SOIP_ETV' ? 'Y' : 'N',
    // Staff see everything
    segmentCode: type === 'Staff' ? 'Staff' : '',
    vip_tier_name: vipTier.value,
    vip_tenure_start_date: vipTenureStart.value,
  }

  addonFields.forEach(field => {
    targetData[field] = addons[field] ? 'Y' : 'N'
  })

  return {
    targetData,
    recipient: {
      rcpContactPIIContactInfo: {
        cb_name_forename: firstName,
        cb_name_surname: surname,
      },
      rcpAcctAccountDimInfo: {
        currency_code: region.value
      },
      rcpAccountKeys: {
        sky_id: '666'
      },
      firstName,
      email: 'joe.bloggs@sky.uk',
      cryptedId: '666666666'
    },
    message: {
      address: 'joe.bloggs@sky.uk'
    },
    escapeUrl(num: number) {
      return num
    },
    variables: {
      transition: transition.value
    },
    delivery: {
      FCP: false
    }
  }
}

// Includes we don't hold are dropped rather than erroring — this tool is about
// the content variants, not the shared furniture. Comment only, so nothing
// shows in the preview but you can still spot it in the source.
function includeStub(view: string) {
  return `<!-- [${view}] -->`
}

// subjectLine and preheader are template-scope vars set inside the transition
// branches — they never reach the output, so read them back off the context.
// Appended to the end of the template, where the hoisted vars hold final values.
const captureSnippet = `
<% try { __capture.subjectLine = typeof subjectLine !== 'undefined' ? subjectLine : null } catch (e) {} %>
<% try { __capture.preheader = typeof preheader !== 'undefined' ? preheader : null } catch (e) {} %>`

const subjectLine = ref<string | null>(null)
const preheader = ref<string | null>(null)

// Subject copy is authored as email HTML, so entities need resolving for display
function decodeEntities(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null
  const el = document.createElement('textarea')
  el.innerHTML = value.replace(/<[^>]+>/g, '')
  return el.value.replace(/\s+/g, ' ').trim() || null
}

const htmlFiles = ref<DroppedFile[]>([])
const selectedTemplate = ref('')
const templateHtml = ref('')
const loadError = ref('')

let assets: AssetMap | null = null

const output = ref('')
const renderError = ref<RenderError | null>(null)

const errorLocation = computed(() => {
  const err = renderError.value
  if (!err?.editorLine) return ''
  return err.include
    ? `inside include '${err.include}' (included at line ${err.editorLine})`
    : `line ${err.editorLine}`
})

// Shallowest path wins, then anything called email.html
function pickTemplate(files: DroppedFile[]) {
  const ranked = [...files].sort((a, b) => {
    const depth = a.path.split('/').length - b.path.split('/').length
    if (depth !== 0) return depth
    const aEmail = /(^|\/)email\.x?html?$/i.test(a.path) ? 0 : 1
    const bEmail = /(^|\/)email\.x?html?$/i.test(b.path) ? 0 : 1
    return aEmail - bEmail
  })
  return ranked[0]?.path ?? ''
}

async function loadTemplate(path: string) {
  const entry = htmlFiles.value.find(f => f.path === path)
  if (!entry) return
  templateHtml.value = await entry.file.text()
}

async function handleFiles(files: DroppedFile[]) {
  assets?.revoke()
  loadError.value = ''
  renderError.value = null
  output.value = ''

  htmlFiles.value = files.filter(f => /\.x?html?$/i.test(f.path))

  if (!htmlFiles.value.length) {
    assets = null
    templateHtml.value = ''
    loadError.value = 'No HTML file in there — drop the folder containing the built template.'
    return
  }

  assets = buildAssetMap(files)
  selectedTemplate.value = pickTemplate(htmlFiles.value)
  await loadTemplate(selectedTemplate.value)
}

watch(selectedTemplate, path => {
  if (path) loadTemplate(path)
})

function render() {
  if (!templateHtml.value) {
    output.value = ''
    return
  }

  const { html, lineMap } = expandTemplate(templateHtml.value, { onUnknownInclude: includeStub })
  const capture: Record<string, unknown> = {}

  try {
    const rendered = ejs.render(html + captureSnippet, {
      ...buildSpotlightContext(),
      __capture: capture
    })
    output.value = assets ? rewriteAssetUrls(rendered, assets) : rendered
    subjectLine.value = decodeEntities(capture.subjectLine)
    preheader.value = decodeEntities(capture.preheader)
    renderError.value = null
  } catch (e) {
    renderError.value = classifyEjsError(e as Error, {
      source: templateHtml.value,
      expandedHtml: html,
      lineMap
    })
  }
}

watch(
  [
    templateHtml, customerType, transition, region, vipTier, vipTenureStart,
    () => addonFields.map(f => addons[f]).join()
  ],
  render
)

function reset() {
  assets?.revoke()
  assets = null
  htmlFiles.value = []
  selectedTemplate.value = ''
  templateHtml.value = ''
  output.value = ''
  subjectLine.value = null
  preheader.value = null
  renderError.value = null
  loadError.value = ''
}

onUnmounted(() => assets?.revoke())
</script>

<template>
  <div v-if="!templateHtml" class="p-8 max-w-2xl mx-auto">
    <FileDropZone
      directory
      icon="image"
      title="Drop the template folder here"
      button-text="Choose folder"
      @files="handleFiles"
    />
    <p class="mt-4 text-center text-sm text-neutral-500">
      The HTML plus its images folder. Loose image files alongside the HTML work too.
    </p>
    <p v-if="loadError" class="mt-4 text-center text-sm text-red-500">
      {{ loadError }}
    </p>
  </div>

  <div v-else class="grid grid-cols-[280px_1fr] h-full">
    <div class="flex flex-col gap-5 overflow-y-auto border-r border-black p-4 text-sm dark:border-neutral-100">
      <div v-if="htmlFiles.length > 1">
        <h3 class="mb-2 font-sky-med">Template</h3>
        <USelect
          v-model="selectedTemplate"
          :items="htmlFiles.map(f => f.path)"
          size="sm"
          class="w-full"
        />
      </div>

      <div>
        <h3 class="mb-2 font-sky-med">Customer</h3>
        <div class="flex flex-col gap-1">
          <UButton
            v-for="type in customerTypes"
            :key="type.value"
            size="sm"
            :variant="customerType === type.value ? 'solid' : 'ghost'"
            :color="customerType === type.value ? 'primary' : 'neutral'"
            @click="customerType = type.value"
          >
            {{ type.label }}
          </UButton>
        </div>
      </div>

      <div>
        <h3 class="mb-2 font-sky-med">Add-ons</h3>
        <div class="space-y-3">
          <div
            v-for="field in addonFields"
            :key="field"
            class="flex items-center justify-between gap-3"
          >
            <span>{{ field.replace('_', ' ') }}</span>
            <USwitch v-model="addons[field]" size="xs" />
          </div>
        </div>
      </div>

      <div>
        <h3 class="mb-2 font-sky-med">Subject Line</h3>
        <div class="flex gap-1">
          <UButton
            v-for="option in ['A', 'B', 'C']"
            :key="option"
            size="sm"
            class="flex-1"
            :variant="transition === option ? 'solid' : 'ghost'"
            :color="transition === option ? 'primary' : 'neutral'"
            @click="transition = option"
          >
            {{ option }}
          </UButton>
        </div>
      </div>

      <div>
        <h3 class="mb-2 font-sky-med">Region</h3>
        <div class="flex gap-1">
          <UButton
            size="sm"
            class="flex-1"
            :variant="region === 'GBP' ? 'solid' : 'ghost'"
            :color="region === 'GBP' ? 'primary' : 'neutral'"
            @click="region = 'GBP'"
          >
            UK
          </UButton>
          <UButton
            size="sm"
            class="flex-1"
            :variant="region === 'EUR' ? 'solid' : 'ghost'"
            :color="region === 'EUR' ? 'primary' : 'neutral'"
            @click="region = 'EUR'"
          >
            ROI
          </UButton>
        </div>
      </div>

      <div class="space-y-3">
        <h3 class="font-sky-med">VIP</h3>
        <UFormField label="Tier" size="sm">
          <UInput v-model="vipTier" size="sm" class="w-full" />
        </UFormField>
        <UFormField label="Tenure start" size="sm">
          <UInput v-model="vipTenureStart" size="sm" class="w-full" />
        </UFormField>
      </div>

      <UButton size="sm" block variant="outline" color="neutral" class="mt-auto" @click="reset">
        Load another folder
      </UButton>
    </div>

    <div class="flex min-h-0 flex-col">
      <div class="shrink-0 border-b border-neutral-200 px-5 py-3 dark:border-neutral-700">
        <p v-if="subjectLine" class="font-sky-med">{{ subjectLine }}</p>
        <p v-else class="font-sky-med text-neutral-400 dark:text-neutral-500">
          No subjectLine set for this variant
        </p>
        <p v-if="preheader" class="mt-0.5 text-sm text-neutral-500 dark:text-neutral-400">
          {{ preheader }}
        </p>
        <p v-else class="mt-0.5 text-sm text-neutral-400 dark:text-neutral-500">
          No preheader set for this variant
        </p>
      </div>

      <div class="relative min-h-0 flex-1">
        <div
          v-if="renderError"
          class="absolute inset-x-0 top-0 z-10 m-2 max-h-[70%] overflow-auto rounded-lg bg-red-600/95 p-3 text-white shadow-lg"
        >
          <div class="flex items-center gap-2 text-sm font-semibold">
            <span class="rounded bg-red-800 px-1.5 py-0.5 text-xs uppercase tracking-wide">
              {{ renderError.title }}
            </span>
            <span v-if="errorLocation">{{ errorLocation }}</span>
          </div>
          <p class="mt-1.5 whitespace-pre-wrap font-mono text-sm">{{ renderError.message }}</p>
          <pre
            v-if="renderError.context"
            class="mt-2 overflow-x-auto rounded bg-red-950/60 p-2 text-xs leading-relaxed"
          >{{ renderError.context }}</pre>
        </div>

        <!-- No sandbox attribute: srcdoc inherits this origin, which is what lets
             the blob: image URLs resolve -->
        <iframe frameborder="0" class="h-full w-full" :srcdoc="output"></iframe>
      </div>
    </div>
  </div>
</template>

<style scoped></style>
