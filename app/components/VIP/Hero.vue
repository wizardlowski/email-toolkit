<script setup>
const props = defineProps({
    imgUrl: String,
    text: String,
    ctaUrl: String,
    ctaText: String,
    csvColumns: {
        type: Object,
        default: () => ({
            imgUrl: 'imgUrl',
            text: 'text',
            ctaUrl: 'ctaUrl',
            ctaText: 'ctaText'
        })
    }
})

const missingFields = computed(() => {
    const missing = []
    if (!props.imgUrl) missing.push(props.csvColumns.imgUrl)
    if (!props.text) missing.push(props.csvColumns.text)
    if (!props.ctaUrl) missing.push(props.csvColumns.ctaUrl)
    if (!props.ctaText) missing.push(props.csvColumns.ctaText)
    return missing
})
</script>

<template>
    <div v-if="missingFields.length > 0" class="text-red-500 my-6">
        <div v-for="field in missingFields" :key="field">
            <span class="font-bold">{{ field }}</span> missing content
        </div>
    </div>

    <template v-else>
        <div class="bg-black pb-4">
            <div class="hero-fade">
                <img :src="imgUrl" alt="" class="w-full"/>
            </div>
            <VIPCopy class="text-white">{{ text }}</VIPCopy>

            <div class="inline-flex gap-3 items-center">
                <img src="https://movableink-assets-production.s3.amazonaws.com/8767/b97d5d3e-3a03-4a67-99d8-c8b4f4770b46/98fb0f81-12bf-4a54-a363-64b9f2ab4147.png" alt="" class="w-[48px]">
                <span class="text-white font-bold whitespace-nowrap">
                    Download the My Sky app
                </span>
            </div>
        </div>

        <VIPCTA :url="ctaUrl" class="mt-4">
            {{ ctaText }}
        </VIPCTA>
    </template>
</template>

<style>
.hero-fade {
    position: relative;
    display: block;
}
.hero-fade::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 25%;
    background-image: linear-gradient(to top, #000, transparent);
    pointer-events: none;
}
</style>