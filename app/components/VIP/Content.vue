<script setup>
const props = defineProps({
    headingText: String,
    imgUrl: String,
    text: String,
    ctaUrl: String,
    ctaText: String,
    csvColumns: {
        type: Object,
        default: () => ({
            headingText: 'headingText',
            imgUrl: 'imgUrl',
            text: 'text',
            ctaUrl: 'ctaUrl',
            ctaText: 'ctaText'
        })
    }
})

const missingFields = computed(() => {
    const missing = []
    if (props.headingText && props.headingText === "") missing.push(props.csvColumns.headingText)
    
    // Check imgUrl - for arrays, check if any individual URLs are missing
    if (!props.imgUrl || (Array.isArray(props.imgUrl) && props.imgUrl.length === 0)) {
        missing.push(props.csvColumns.imgUrl)
    } else if (Array.isArray(props.imgUrl)) {
        // Check each URL in the array for missing values
        const hasEmptyUrl = props.imgUrl.some(url => !url || url.trim() === '')
        if (hasEmptyUrl) missing.push(props.csvColumns.imgUrl)
    }
    
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
        <div class="pb-12">
            <h2 v-if="headingText" class="text-[28px] leading-8 mt-0 mx-6 mb-1">
                {{ headingText }}
            </h2>

            <img :src="imgUrl" alt="">

            <p class="text-[17px] leading-[22px] mt-1 mx-6 mb-6">
                {{ text }}
            </p>

            <a :href="ctaUrl" target="_blank" class="bg-[#000FF5] text-white rounded-[4px] inline-block w-[328px] leading-11 align-middle text-[18px] font-bold">
                {{ ctaText }}
            </a>

        </div>
    </template>
</template>