<script lang="ts" setup>
import { det } from "detergent";
import { useClipboard } from '@vueuse/core'

const colourInput = ref('4a4a4a')

const colourValue = computed(() => {
  if (colourInput.value.includes('#')) {
    return colourInput.value.slice(1,7);
  }

  return colourInput.value;
})

const underline = ref(false)
const underlineStyle = computed(() => {
  return underline.value === true ? 'underline' : 'none'
})

const inputText = ref('')
const outputText = ref('')

watch(inputText, cleanTheLegalTextOut)
watch(colourInput, cleanTheLegalTextOut)
watch(underline, cleanTheLegalTextOut)

function cleanTheLegalTextOut () {
  outputText.value = "Loading..."

  const cleaned = det(inputText.value, {
    fixBrokenEntities: true,
    removeWidows: true,
    convertEntities: true,
    convertDashes: true,
    convertApostrophes: true,
    replaceLineBreaks: true,
    removeLineBreaks: false,
    useXHTML: false,
    dontEncodeNonLatin: true,
    addMissingSpaces: true,
    convertDotsToEllipsis: true,
    stripHtml: false,
  }).res;

  outputText.value = addTheLinkBits(cleaned)
}

function addTheLinkBits (txt: string) {
  const replacer = (match: string, offset: number, string: string) => {
    let url;
    if (!match.includes('https://') && !match.includes('www.')) {
      url = 'https://www.' + match
    }
    if (!match.includes('https://') && match.includes('www.')) {
      url = 'https://' + match
    }
    if (match.includes('https://www.') || match.includes('http://www.')) {
      url = match
    }
    return `<a href="${url}" target="_blank" style="color:#${colourValue.value}; text-decoration:${underlineStyle.value};">${match}</a>`
  }

  // complete text to output field
  return txt.replace(/[-a-zA-Z0-9@:%_\+.~#?&//=]{2,256}\.[a-z]{2,4}\b(\/[-a-zA-Z0-9@:%_\+~#?&//=]*)?/ig ,replacer)
}

const { copy } = useClipboard()
const copyBtnText = ref('copy to clipboard')

function clipboardCopy () {
  copy(outputText.value)
  copyBtnText.value = 'copied!'

  setTimeout(() => {
    copyBtnText.value = 'copy to clipboard'
  }, 1000)
}

function clear () {
  colourInput.value = '4a4a4a'
  underline.value = false
  inputText.value = ''
  outputText.value = ''
}

useHead({
  title: 'Legaleez'
})
</script>

<template>
  <div class="text-xl p-4 min-h-full grid gap-4 grid-cols-2 grid-rows-[40px_50px_auto]">
    <div class="col-[1_/_-1] relative self-center">
      <div class="flex items-center justify-center uppercase">
        <label class="flex items-center" for="linkColourInput">
          colour:
          <input v-model.trim="colourInput" class="ml-3 mr-12 pl-1 text-inherit bg-white dark:bg-neutral-700 dark:border-neutral-100 border-black border" type="text">
        </label>
        <label class="flex items-center" for="underlineToggle">
          underline:
          <input v-model="underline" :checked="underline" class="ml-3" type="checkbox">
        </label>
      </div>
    </div>

    <UButton class="place-self-center" @click="clear">
      Clear all
    </UButton>

    <UButton class="place-self-center" @click="clipboardCopy">
      {{ copyBtnText }}
    </UButton>
    
    <textarea v-model="inputText" class="resize-none p-1 text-inherit bg-white dark:bg-neutral-700 dark:border-neutral-100 border-black border" spellcheck="false" autofocus></textarea>
    <textarea v-model="outputText" class="resize-none p-1 text-inherit bg-white dark:bg-neutral-700 dark:border-neutral-100 border-black border" spellcheck="false"></textarea>
  </div>
</template>

