<script lang="ts" setup>
const router = useRouter()
const currentToolName = computed(() => {
  if (router.currentRoute.value.name === 'index') return null
  return router.currentRoute.value.name
})
</script>

<template>
  <header class="py-2 px-5 border-b border-black dark:border-neutral-100">
    <UContainer class="flex justify-between items-center">
      <NuxtLink to="/">ETK</NuxtLink>
  
      <h1 class="capitalize text-2xl font-bold">
        {{ currentToolName }}
      </h1>
  
      <UColorModeButton />
    </UContainer>
  </header>
</template>
