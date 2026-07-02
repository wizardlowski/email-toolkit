<script setup lang="ts">
import type { editor } from 'monaco-editor'
import { registerEjsLanguage } from '~/util/monaco-ejs'

const model = defineModel<string>({ default: '' })
const props = defineProps<{
  marker?: { line: number, message: string } | null
}>()
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

const editorInstance = shallowRef<editor.IStandaloneCodeEditor>()
function onLoad(instance: editor.IStandaloneCodeEditor) {
  editorInstance.value = instance
}

watch([() => props.marker, editorInstance], () => {
  const editorModel = editorInstance.value?.getModel()
  if (!editorModel) return

  const line = props.marker
    ? Math.min(Math.max(props.marker.line, 1), editorModel.getLineCount())
    : 0

  monaco.editor.setModelMarkers(editorModel, 'logik', props.marker
    ? [{
        severity: monaco.MarkerSeverity.Error,
        message: props.marker.message,
        startLineNumber: line,
        startColumn: 1,
        endLineNumber: line,
        endColumn: editorModel.getLineLength(line) + 1
      }]
    : [])
})

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
    @load="onLoad"
  />

  <UButton v-if="model" class="absolute bottom-8 right-8" @click="clear">
    Clear
  </UButton>
</template>
