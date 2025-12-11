<script setup lang="ts">
interface Props {
  accept?: string
  multiple?: boolean
  disabled?: boolean
  icon?: 'image' | 'document' | 'email'
  title?: string
  subtitle?: string
  buttonText?: string
}

interface Emits {
  (e: 'drop', files: File[]): void
  (e: 'input', files: File[]): void
}

const props = withDefaults(defineProps<Props>(), {
  accept: '*',
  multiple: false,
  disabled: false,
  icon: 'document',
  title: 'Drag and drop files here',
  subtitle: 'or',
  buttonText: 'Choose Files'
})

const emit = defineEmits<Emits>()

const isDragOver = ref(false)
const fileInputId = `file-upload-${Math.random().toString(36).substr(2, 9)}`

function handleDragEnter(e: DragEvent) {
  if (props.disabled) return
  e.preventDefault()
  isDragOver.value = true
}

function handleDragLeave(e: DragEvent) {
  if (props.disabled) return
  e.preventDefault()
  isDragOver.value = false
}

function handleDragOver(e: DragEvent) {
  if (props.disabled) return
  e.preventDefault()
}

async function handleDrop(e: DragEvent) {
  if (props.disabled) return
  e.preventDefault()
  isDragOver.value = false
  
  const files = Array.from(e.dataTransfer?.files || [])
  if (files.length === 0) return

  emit('drop', files)
}

async function handleFileInput(e: Event) {
  if (props.disabled) return
  const target = e.target as HTMLInputElement
  const files = Array.from(target.files || [])
  
  if (files.length === 0) return

  emit('input', files)
}

const iconPaths = {
  image: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z",
  document: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  email: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
}
</script>

<template>
  <div 
    class="border-2 border-dashed border-neutral-300 dark:border-neutral-600 rounded-lg p-8 text-center transition-colors"
    :class="{ 
      'border-primary-500 bg-primary-50 dark:bg-primary-900/20': isDragOver && !disabled,
      'opacity-50 cursor-not-allowed': disabled,
      'cursor-pointer': !disabled
    }"
    @dragenter="handleDragEnter"
    @dragleave="handleDragLeave"
    @dragover="handleDragOver"
    @drop="handleDrop"
  >
    <div class="mb-4">
      <svg class="w-12 h-12 mx-auto text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="iconPaths[icon]" />
      </svg>
    </div>
    <p class="text-lg mb-2">{{ title }}</p>
    <p class="text-sm text-neutral-500 mb-4">{{ subtitle }}</p>
    
    <label :for="fileInputId" class="cursor-pointer">
      <UButton as="span" :disabled="disabled">
        {{ buttonText }}
      </UButton>
      <input 
        :id="fileInputId"
        type="file" 
        :accept="accept"
        :multiple="multiple"
        :disabled="disabled"
        class="hidden"
        @change="handleFileInput"
      >
    </label>
  </div>
</template>