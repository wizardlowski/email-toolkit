<script setup lang="ts">
useHead({
  title: 'Gradient Wrap'
})
definePageMeta({
  name: 'Gradient Wrap'
})

const input = ref('')
type GradientKey = keyof typeof GRADIENTS;
const gradientSelected = ref<GradientKey>('brand')
const gradientSelectOptions = ['brand', 'broadband', 'mobile', 'skyq', 'cinema', 'protect', 'sport']

// Define gradient colors
const GRADIENTS = {
  "brand": [
    { colour: '#ff8c00', stop: 0.0 },
    { colour: '#ff8c00', stop: 0.05 },
    { colour: '#ff0064', stop: 0.25 },
    { colour: '#ff00a0', stop: 0.4 },
    { colour: '#8c28ff', stop: 0.6 },
    { colour: '#0023ff', stop: 0.8 },
    { colour: '#19a0ff', stop: 0.95 },
    { colour: '#19a0ff', stop: 1 } 
  ],
  "broadband": [
    { colour: '#6E00FF', stop: 0.0 },
    { colour: '#A500D7', stop: 0.3 },
    { colour: '#FF00A5', stop: 0.75 },
    { colour: '#FF00A5', stop: 1 } 
  ],
  "mobile": [
    { colour: '#FF00A5', stop: 0.0 },
    { colour: '#FF00A5', stop: 0.1 },
    { colour: '#FF0A50', stop: 0.5 },
    { colour: '#FF6400', stop: 1 } 
  ],
  "skyq": [
    { colour: '#000FF5', stop: 0.0 },
    { colour: '#000FF5', stop: 0.1 },
    { colour: '#00D2FF', stop: 0.9 },
    { colour: '#00D2FF', stop: 1 } 
  ],
  "cinema": [
    { colour: '#FF0031', stop: 0 },
    { colour: '#9B001F', stop: 1 } 
  ],
  "protect": [
    { colour: '#FF2800', stop: 0.0 },
    { colour: '#FF371E', stop: 0.3 },
    { colour: '#F06400', stop: 1 } 
  ],
  "sport": [
    { colour: '#0F1151', stop: 0 },
    { colour: '#030C7E', stop: 1 } 
  ],
}

// Function to calculate the interpolated colour
function calculate_colour(percent:number, gradientColours:Array<{ colour: string, stop: number }>) {
  percent = Math.min(1, Math.max(0, percent));
  
  // Find the two colours that the percent falls between
  let index1 = 0;
  let index2 = gradientColours.length - 1;

  for (let i = 0; i < gradientColours.length - 1; i++) {
    if (percent >= gradientColours[i].stop && percent <= gradientColours[i + 1].stop) {
      index1 = i;
      index2 = i + 1;
      break;
    }
  }

  const colour1 = gradientColours[index1];
  const colour2 = gradientColours[index2];

  // Calculate the relative position between colour1.stop and colour2.stop
  const range = colour2.stop - colour1.stop;
  const relativePercent = (percent - colour1.stop) / range;

  // Extract RGB values
  const startR = parseInt(colour1.colour.substring(1, 3), 16);
  const startG = parseInt(colour1.colour.substring(3, 5), 16);
  const startB = parseInt(colour1.colour.substring(5, 7), 16);

  const endR = parseInt(colour2.colour.substring(1, 3), 16);
  const endG = parseInt(colour2.colour.substring(3, 5), 16);
  const endB = parseInt(colour2.colour.substring(5, 7), 16);

  // Interpolate the RGB values
  const r = Math.round(startR * (1 - relativePercent) + endR * relativePercent);
  const g = Math.round(startG * (1 - relativePercent) + endG * relativePercent);
  const b = Math.round(startB * (1 - relativePercent) + endB * relativePercent);

  // Convert the resulting colour back to hex format
  return '#' + componentToHex(r) + componentToHex(g) + componentToHex(b);
}

// Helper function to convert RGB component to a two-character hex string
function componentToHex(c:number) {
  const hex = c.toString(16);
  return hex.length === 1 ? '0' + hex : hex;
}

function wrapTextWithGradient(text:string , gradientColours:Array<{ colour: string, stop: number }>) {
  let output = '';
  const lines = text.split('\n');
  
  // Find the length of the longest line
  let maxLength = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].length > maxLength) {
      maxLength = lines[i].length;
    }
  }
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const colourStep = 1 / (maxLength - 1);
    const centerOffset = (maxLength - line.length) / 2;
    
    for (let j = 0; j < line.length; j++) {
      const percent = (j + centerOffset) * colourStep;
      const colour = calculate_colour(percent, gradientColours);

      // don't wrap a space (small reduction to amount of HTML)
      if (line[j] === ' ') {
        output += line[j]
      } else {
        output += '<span style="color:' + colour + '">' + line[j] + '</span>';
      }
    }
    
    // Add line break if multiple lines and not to the final line
    if (i !== (lines.length - 1)) {
      output += '<br>';
    }
  }
  
  // Adding some aria to improve accessibility of split text
  const textForAria = text.replace('\n', ' ')
  return '<span aria-label="' + textForAria + '" role="text"><span aria-hidden="true">' + output + '</span></span>';
}

const output = computed<string>(() => wrapTextWithGradient(input.value, GRADIENTS[gradientSelected.value]))

const fontValue = ref<number>(36)
const fontSize = computed(() => { return { fontSize: fontValue.value + 'px'}})
const toggleBold = ref<boolean>(false)
const useArialFont = ref<boolean>(false)

const containerSizeMobile = ref<boolean>(false)

watch(containerSizeMobile, (isMobile) => {
  if (isMobile) {
    if (fontValue.value === 36) fontValue.value = 26;
    else if (fontValue.value === 28) fontValue.value = 18;
    else if (fontValue.value === 21) fontValue.value = 16;
    else if (fontValue.value === 16) fontValue.value = 14;
  } else {
    if (fontValue.value === 26) fontValue.value = 36;
    else if (fontValue.value === 18) fontValue.value = 28;
    else if (fontValue.value === 16) fontValue.value = 21;
    else if (fontValue.value === 14) fontValue.value = 16;
  }
})

const { copy } = useClipboard()
const copyBtnText = ref<string>('copy html to clipboard')

function clipboardCopy () {
  copy(output.value)
  copyBtnText.value = 'copied!'

  setTimeout(() => {
    copyBtnText.value = 'copy html to clipboard'
  }, 1000)
}
</script>

<template>
  <UContainer class="mt-8 space-y-6 text-center !px-0" :style="{ width: containerSizeMobile ? '375px' : '600px' }">
    <UFormField label="Text:">
      <UTextarea 
        v-model="input" 
        :rows="4" 
        placeholder="Text here" 
        autoresize 
      />
      <USelect 
        v-model="gradientSelected" 
        :options="gradientSelectOptions" 
        class="mt-4" 
      />

      <div class="mt-6 flex justify-center gap-4 rounded-none">
        <UButton 
          @click="fontValue = containerSizeMobile ? 26 : 36" 
          class="lowercase" 
          :class="{ 'bg-primary-700': fontValue === (containerSizeMobile ? 26 : 36) }"
        >{{ containerSizeMobile ? '26px' : '36px' }}</UButton>
        <UButton 
          @click="fontValue = containerSizeMobile ? 18 : 28" 
          class="lowercase" 
          :class="{ 'bg-primary-700': fontValue === (containerSizeMobile ? 18 : 28) }"
        >{{ containerSizeMobile ? '18px' : '28px' }}</UButton>
        <UButton 
          @click="fontValue = containerSizeMobile ? 16 : 21" 
          class="lowercase" 
          :class="{ 'bg-primary-700': fontValue === (containerSizeMobile ? 16 : 21) }"
        >{{ containerSizeMobile ? '16px' : '21px' }}</UButton>
        <UButton 
          @click="fontValue = containerSizeMobile ? 14 : 16" 
          class="lowercase" 
          :class="{ 'bg-primary-700': fontValue === (containerSizeMobile ? 14 : 16) }"
        >{{ containerSizeMobile ? '14px' : '16px' }}</UButton>
      </div>
      <div class="mt-3 flex justify-center gap-4 rounded-none">
        <UInput 
          v-model="fontValue"
          placeholder="Custom"
          class="rounded !w-20 h-full shadow-none ring-primary-500"
          type="number" 
          min="1"
        />
        <UButton 
          @click="toggleBold = !toggleBold" 
          class="capitalize" 
          :class="{ 'bg-primary-700': toggleBold }"
        >Bold</UButton>
        <UButton 
          @click="useArialFont = !useArialFont" 
          class="capitalize" 
          :class="{ 'bg-primary-700': useArialFont }"
        >Arial</UButton>
        <UButton 
          @click="containerSizeMobile = !containerSizeMobile" 
          class="capitalize"
        >{{ containerSizeMobile ? 'Desktop' : 'Mobile' }}</UButton>
      </div>
    </UFormField>

    <UContainer class="bg-white dark:bg-neutral-900 shadow rounded py-4 mx-auto sm:!pl-[5%] sm:!pr-[5%]">
      <h1 v-html="output" class="leading-tight" :class="{ 'font-bold': toggleBold, 'font-arial': useArialFont }" :style="fontSize">
        
      </h1>
    </UContainer>

    <UButton @click="clipboardCopy" :disabled="input.length === 0">{{ copyBtnText }}</UButton>
      
  </UContainer>
</template>

