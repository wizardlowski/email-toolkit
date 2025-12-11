<script lang="ts" setup>
import * as spectrum from '~/util/spectrumGradients.js'

const props = defineProps({
  inputText: String,
  fontSize: Number,
  lineHeight: Number,
  width: Number,
  gradient: String,
  filename: String
})

const canvasRef = ref();
const canvas = reactive({
  context: undefined,
  width: 600,
  height: 44,
  textWidth: 0
})
const lineCount = ref(1)

const gradient = computed(() => {
  const gradientSetting = canvas.context.createLinearGradient(
    (canvas.width / 2) - (canvas.textWidth / 2),
    canvas.height / 2,
    (canvas.width / 2) + (canvas.textWidth / 2),
    canvas.height / 2,
  );

  spectrum[props.gradient].stops.forEach(item => {
    gradientSetting.addColorStop(item.offset, item.colour)
  })

  return gradientSetting;
})

function updateCanvas() {
  // get canvas context
  canvas.context = canvasRef.value.getContext('2d')

  // set width
  canvas.width = props.width

  // clear canvas
  canvas.context.clearRect(0, 0, canvas.width, canvas.height)
  
  // set font style
  canvas.context.font = `${props.fontSize}px 'Sky Text'`
  canvas.context.textBaseline = "top"
  canvas.context.textAlign = "center"

  const lines = props.inputText.split('\n')
  lineCount.value = lines.length

  canvas.height = props.lineHeight * lineCount.value

  const longest = lines.reduce((longest, currentWord) => {
    return currentWord.length > longest.length ? currentWord : longest;
  }, "");
  let linePosition = 0;

  for (const line of lines) {
    // set textWidth to length of longest line
    if (line.length === longest.length) {
      canvas.textWidth = canvas.context.measureText(line).width;
    }
    canvas.context.fillStyle = gradient.value;
    
    canvas.context.fillText(line, canvas.width / 2, linePosition)
    linePosition += props.lineHeight

  }

  updateDownloadUrl()
}

const downloadUrl = ref('')
const updateDownloadUrl = () => {
  downloadUrl.value = canvasRef.value.toDataURL('image/png')
}

// Boolean attribute for multiple download on STV headline generator
const hascopy = computed(() => props.inputText !== '' ? true : false)

onUpdated(() => {
  updateCanvas()
})

</script>

<template>
  <a :href="downloadUrl" :download="filename" :hascopy="hascopy" class="download">
    <canvas 
      class="align-middle border border-neutral-400 w-full h-auto" 
      ref="canvasRef" 
      :width="canvas.width" 
      :height="canvas.height"
    ></canvas>
  </a>
</template>
