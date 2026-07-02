<script lang="ts" setup>
// @ts-ignore
import ejs from 'ejs'

import { expandTemplate, buildContext, type LineOrigin } from '~/util/logik-expand'
import { ejsLint } from '~/util/ejs-lint'

useHead({
  title: 'Logik'
})

const input = useLocalStorage('logik-editor', '')
const targetDataInput = useLocalStorage('logik-target-data', '{}')

const getTargetData = (html: string) => {
  const targetDataRegex = /(targetData\.[a-zA-Z0-9_-]+)/gm;

  const dataMatches = html.match(targetDataRegex);
  const uniqueFields = Array.from(new Set(dataMatches))

  const flags = uniqueFields.reduce((a, v) => ({...a, [v.slice(11)]:''}), {})
  targetDataInput.value = JSON.stringify(flags, null, 1)
}

const region = useLocalStorage('logik-region', 'GBP')
function toggleRegion() {
  region.value = region.value === "GBP" ? "EUR" : "GBP"
  updateOutput()
}
const regionBtnText = computed(() => {
  return region.value === "GBP" ? "UK" : "ROI"
})

function buildRecipientData(tData: Record<string, unknown> | null) {
  const firstName = region.value === 'GBP' ? 'Joe' : 'Jane'
  const surname = region.value === 'GBP' ? 'Bloggs' : 'Doe'

  return {
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
      firstName: 'Joe',
      email: 'joe.bloggs@sky.uk',
      cryptedId: '666666666'
    },
    message: {
      address: 'joe.bloggs@sky.uk'
    },
    escapeUrl (num: number) {
      return num
    },
    targetData: {
      ...tData
    },
    delivery: {
      FCP: true
    }
  }
}

const expanded = computed(() => expandTemplate(input.value))

interface RenderError {
  type: 'include' | 'data' | 'runtime' | 'syntax' | 'unknown'
  title: string
  message: string
  editorLine?: number
  include?: string
  context?: string
}

const output = ref('')
const renderError = ref<RenderError | null>(null)

const errorLocation = computed(() => {
  const err = renderError.value
  if (!err?.editorLine) return ''
  return err.include
    ? `inside include '${err.include}' (included at line ${err.editorLine})`
    : `line ${err.editorLine}`
})

const editorMarker = computed(() => {
  const err = renderError.value
  if (!err?.editorLine || err.include) return null
  return { line: err.editorLine, message: err.message }
})

function classifyEjsError(e: Error, lineMap: LineOrigin[]): RenderError {
  // Runtime errors: ejs rethrow prefixes "ejs:<line>\n<context>\n\n<message>"
  // where <line> refers to the include-expanded template
  const runtimeMatch = e.message.match(/^ejs:(\d+)\n/)
  if (runtimeMatch) {
    const expandedLine = Number(runtimeMatch[1])
    const origin = lineMap[expandedLine - 1]
    const parts = e.message.split('\n\n')
    const message = parts.slice(1).join('\n\n').trim() || e.message
    const ejsContext = parts[0].split('\n').slice(1).join('\n')

    return {
      type: 'runtime',
      title: 'Runtime error',
      message,
      editorLine: origin?.editorLine,
      include: origin?.include,
      context: origin && !origin.include
        ? buildContext(input.value, origin.editorLine)
        : ejsContext
    }
  }

  // Compile errors: ejs gives no line, so lint the expanded template to find it
  if (e instanceof SyntaxError) {
    const lint = ejsLint(expanded.value.html)
    if (lint) {
      const origin = lineMap[lint.line - 1]
      return {
        type: 'syntax',
        title: 'Syntax error',
        message: lint.message,
        editorLine: origin?.editorLine,
        include: origin?.include,
        context: origin && !origin.include
          ? buildContext(input.value, origin.editorLine)
          : buildContext(expanded.value.html, lint.line)
      }
    }
    return {
      type: 'syntax',
      title: 'Syntax error',
      message: e.message.split('\n')[0].replace(/ while compiling ejs$/, '')
        + ' — check your <% %> blocks'
    }
  }

  return { type: 'unknown', title: 'Render error', message: e.message }
}

function updateOutput() {
  if (targetDataInput.value === '{}') {
    getTargetData(input.value)
  }

  let tData: Record<string, unknown> | null = null
  if (targetDataInput.value !== '{}') {
    try {
      tData = JSON.parse(targetDataInput.value)
    } catch (e) {
      renderError.value = {
        type: 'data',
        title: 'Invalid target data JSON',
        message: (e as Error).message
      }
      return
    }
  }

  const { html, lineMap, unresolved } = expanded.value
  if (unresolved.length) {
    const u = unresolved[0]
    renderError.value = {
      type: 'include',
      title: 'Unknown include',
      message: `'${u.view}' is not in the include registry — add it to app/util/logik-includes.js`,
      editorLine: u.editorLine,
      context: buildContext(input.value, u.editorLine)
    }
    return
  }

  try {
    output.value = ejs.render(html, buildRecipientData(tData))
    renderError.value = null
  } catch (e) {
    renderError.value = classifyEjsError(e as Error, lineMap)
  }
}

const debouncedUpdate = useDebounceFn(updateOutput, 300)
watch(input, debouncedUpdate)

onMounted(() => {
  if (input.value) nextTick(updateOutput)
})

function clearAll() {
  input.value = ''
  output.value = ''
  renderError.value = null
  targetDataInput.value = '{}'
}
</script>

<template>
  <div class="grid grid-cols-[1fr_640px]">
    <div class="relative flex flex-col">
      <UTextarea
        v-model="targetDataInput"
        @keyup="debouncedUpdate"
        :rows="5"
        class="shrink-0"
        :ui="{ base: 'rounded-none border-r border-b border-black dark:border-neutral-100' }"
      />

      <LazyClientOnly>
        <Editor v-model="input" :marker="editorMarker" @clear="clearAll"/>
      </LazyClientOnly>

      <UButton v-if="input" class="absolute bottom-20 right-8" @click="toggleRegion">
        {{ regionBtnText }}
      </UButton>
    </div>

    <div class="relative">
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

      <iframe frameborder="0" class="h-full w-full" :srcdoc="output"></iframe>
    </div>
  </div>
</template>

<style scoped></style>
