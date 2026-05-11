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
        <div>
            <img :src="imgUrl" alt="" class="w-full"/>
            <VIPCopy>{{ text }}</VIPCopy>

            <div class="inline-flex gap-3 items-center">
                <img src="/vip-dl.png" alt="" class="w-[48px]">
                <span class="font-bold whitespace-nowrap">
                    Download the My Sky app
                </span>
            </div>
        </div>

        <VIPCTA :url="ctaUrl" class="mt-4">
            {{ ctaText }}
        </VIPCTA>
    </template>
</template>

<style></style>