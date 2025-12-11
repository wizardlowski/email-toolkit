<script lang="ts" setup>
// @ts-ignore
import ejs from 'ejs'

import { footerStart, footerEnd, gridSTV, gridCIN, cinWeeklyMovies, fixDecimal, forwardXDays, formatPricePoint } from '~/util/logik-includes.js'

useHead({
  title: 'Logik'
})

const input = ref('')
function editorUpdate(text: string) {
  input.value = text
}
const targetDataInput = ref('{}')

const getTargetData = (html: string) => {
  const targetDataRegex = /(targetData\.[a-zA-Z0-9_-]+)/gm;
  
  const dataMatches = html.match(targetDataRegex);
  const uniqueFields = Array.from(new Set(dataMatches))

  const flags = uniqueFields.reduce((a, v) => ({...a, [v.slice(11)]:''}), {})
  targetDataInput.value = JSON.stringify(flags, null, 1)
}

const region = ref('GBP')
function toggleRegion() {
  region.value = region.value === "GBP" ? "EUR" : "GBP"
  updateOutput()
}
const regionBtnText = computed(() => {
  return region.value === "GBP" ? "UK" : "ROI"
})

const dataObj = computed(() => {
  const tData = targetDataInput.value !== '{}' ? JSON.parse(targetDataInput.value) : null
  const firstName = region.value === 'GBP' ? 'Joe' : 'Jane'
  const surname = region.value === 'GBP' ? 'Bloggs' : 'Doe'
  
  const recipient = {
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

  return recipient
})

const inputHTML = computed(() => {
  let processed = input.value
                    .replace("<%@ include view='MirrorPageUrl' %>", 'https://www.sky.com/')
                    .replace(/<%@\s*include\s*view='Footer_\w*START'\s*%>/gm, footerStart)
                    .replace("<%@ include view='Footer_END' %>", footerEnd)
                    .replace("<%@ include view='STV_Personalised_Hero_Grid_Master' %>", gridSTV)
                    .replace("<%@ include view='CinemaWeekly_Personalised_Hero_Grid' %>", gridCIN)
                    .replace("<%@ include view='CinemaWeekly_MoviesFromData' %>", cinWeeklyMovies)
                    .replace("<%@ include view='fixDecimal' %>", fixDecimal)
                    .replace("<%@ include view='forwardXDays' %>", forwardXDays)
                    .replace("<%@ include view='formatPricePoint' %>", formatPricePoint)
                    .replace(/<%=/g, '<%-')
  return processed;
})

const output = ref('')
const outputFrame = ref()
async function updateOutput() {
  if (targetDataInput.value === '{}') {
    await getTargetData(input.value)
  }

  try {
    output.value = ejs.render(inputHTML.value, dataObj.value)
    outputFrame.value.style.backgroundColor = "initial"
  } catch (e) {
    output.value = (e as Error).stack || 'Unknown error';
    outputFrame.value.style.backgroundColor = "rgb(235, 64, 52)"
  }
}

watch(input, updateOutput)

function clearAll() {
  input.value = ''
  output.value = ''
  targetDataInput.value = '{}'
}
</script>

<template>
  <div class="grid grid-cols-[1fr_640px]">
    <div class="relative flex flex-col">
      <UTextarea
        v-model="targetDataInput"
        @keyup="updateOutput"
        :rows="5"
        class="shrink-0"
        :ui="{ base: 'rounded-none border-r border-b border-black dark:border-neutral-100' }"
      />
      
      <LazyClientOnly>
        <Editor @update="editorUpdate" @clear="clearAll"/>
      </LazyClientOnly>

      <UButton v-if="input" class="absolute bottom-20 right-8" @click="toggleRegion">
        {{ regionBtnText }}
      </UButton>
    </div>

    <iframe ref="outputFrame" frameborder="0" class="w-full h-full" :srcdoc="output"></iframe>
  </div>
</template>

<style scoped></style>
