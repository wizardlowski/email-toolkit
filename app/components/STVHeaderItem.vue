<script lang="ts" setup>
const props = defineProps({
  filename: String,
  id: Number
})

const inputText = ref('')
const filenameText = ref('')

const canvas = reactive({
  context: null,
  width: null,
  height: null
})
const text = reactive({
  fontSize: null,
  lineHeight: null,
})

onMounted(() => {
  filenameText.value = props.filename

  // set canvas dimensions
  if (props.filename.endsWith('--mb')) {
    canvas.width = 640
    text.lineHeight = 50
    text.fontSize = 48
  } else {
    canvas.width = 1200
    text.lineHeight = 68
    text.fontSize = 60
  }
})

</script>

<template>
  <div class="grid grid-cols-1 grid-rows-[66px_auto_22px] rounded p-4 item-shadow">
    <textarea class="w-full resize-none text-center border border-neutral-400 bg-inherit" rows="4" v-model.trim="inputText"></textarea>
    <div class="my-4">

      <SpectrumCanvasText 
        :inputText="inputText"
        :fontSize="text.fontSize"
        :lineHeight="text.lineHeight"
        :width="canvas.width"
        gradient="Spectrum"
        :filename="filenameText"
      />

    </div>
    <input type="text" class="w-full text-center border border-neutral-400 bg-inherit" v-model.trim="filenameText">
  </div>
</template>

<style scoped>
.item-shadow {
  box-shadow: 0 1px 3px 1px rgba(0, 0, 0, 0.3);
}
.dark .item-shadow{
  box-shadow: 0 1px 3px 1px rgba(255, 255, 255, 0.3);
}
</style>