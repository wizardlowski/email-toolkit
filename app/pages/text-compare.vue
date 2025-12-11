<script setup lang="ts">
import { diffWords } from 'diff'

useHead({
  title: 'Text Compare'
})
definePageMeta({
  name: 'Text Compare'
})

const textOneInput = ref<string>('')
const textTwoInput = ref<string>('')
const textOneOutput = ref<string>('')
const textTwoOutput = ref<string>('')
const compared = ref<boolean>(false)
const noDifference = ref<boolean>(false)

function compare () {
  noDifference.value = false

  const diff = diffWords(textOneInput.value, textTwoInput.value, {
    ignoreWhitespace: false
  })

  if (diff.length === 1) {
    noDifference.value = true
    compared.value = false
    return
  }

  compared.value = true

  console.log(diff)

  let outputOne = ''
  let outputTwo = ''
  diff.forEach((part) => {
    if (part.removed) {
      outputOne += `${part.value.startsWith('\n') ? '<br>' : ''}<span class="highlight">${part.value}</span>${part.value.endsWith('\n') ? '<br>' : ''}`
      return
    }
    if (part.added) {
      outputTwo += `${part.value.startsWith('\n') ? '<br>' : ''}<span class="highlight">${part.value}</span>${part.value.endsWith('\n') ? '<br>' : ''}`
      return
    }

    const noHighlight = `${part.value.startsWith('\n') ? '<br>' : ''}${part.value}${part.value.endsWith('\n') ? '<br>' : ''}`
    outputOne += noHighlight
    outputTwo += noHighlight
  })
  textOneOutput.value = outputOne
  textTwoOutput.value = outputTwo
}

function clearAll () {
  textOneInput.value = ''
  textTwoInput.value = ''
  textOneOutput.value = ''
  textTwoOutput.value = ''
  compared.value = false
  noDifference.value = false
}
</script>
<template>
  <div class="p-4 min-h-full">
    <div v-if="compared" class="grid gap-4 grid-cols-2 pb-4">
      <div v-html="textOneOutput" class="relative block w-full disabled:cursor-not-allowed disabled:opacity-75 focus:outline-none border-0 form-textarea rounded-md placeholder-neutral-400 dark:placeholder-neutral-500 text-sm px-2.5 py-1.5 shadow-sm bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white ring-1 ring-inset ring-neutral-300 dark:ring-neutral-700 focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 resize-none"></div>
      <div v-html="textTwoOutput" class="relative block w-full disabled:cursor-not-allowed disabled:opacity-75 focus:outline-none border-0 form-textarea rounded-md placeholder-neutral-400 dark:placeholder-neutral-500 text-sm px-2.5 py-1.5 shadow-sm bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white ring-1 ring-inset ring-neutral-300 dark:ring-neutral-700 focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 resize-none"></div>
    </div>

    <div v-if="noDifference" class="text-center text-xl mb-4">
      No differences found!
    </div>

    <div class="mb-4 flex gap-4 justify-center">
      <UButton @click="compare">
        Compare
      </UButton>
      <UButton @click="clearAll">
        Clear All
      </UButton>
    </div>

    <div class="grid gap-4 grid-cols-2">
      <UTextarea v-model="textOneInput" :rows="20" />
      <UTextarea v-model="textTwoInput" :rows="20" />
    </div>
  </div>
</template>

<style>
span.highlight {
  display: inline-block;
  border-radius: 2px;
  background-color: hsl(14, 100%, 80%);
  white-space: preserve;
}
.dark span.highlight {
  background-color: hsl(14, 100%, 40%);
}
</style>