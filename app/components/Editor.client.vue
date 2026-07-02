<script setup lang="ts">
import type { editor } from 'monaco-editor'
import { registerEjsLanguage } from '~/util/monaco-ejs'

const model = defineModel<string>({ default: '' })
const emits = defineEmits(['clear'])

const monaco = await useMonaco()
registerEjsLanguage(monaco)

const editorOptions: editor.IStandaloneEditorConstructionOptions = {
  wordWrap: 'on',
  minimap: { enabled: false },
  stickyScroll: { enabled: false },
  theme: 'vs-dark',
  automaticLayout: true
}

function clear() {
  model.value = ''
  emits('clear')
}
</script>
<template>
  <MonacoEditor
    v-model="model"
    lang="ejs"
    :options="editorOptions"
    class="flex-1 min-h-0"
  />

  <UButton v-if="model" class="absolute bottom-8 right-8" @click="clear">
    Clear
  </UButton>
</template>
