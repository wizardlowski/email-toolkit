<script lang="ts" setup>
const colorMode = useColorMode()

const isDark = computed({
  get () {
    return colorMode.value === 'dark'
  },
  set () {
    colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'
  }
})

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
  
      <div class="toggle-container">
        <UButton
          :icon="isDark ? 'i-heroicons-moon-20-solid' : 'i-heroicons-sun-20-solid'"
          color="neutral"
          variant="ghost"
          aria-label="Theme"
          @click="isDark = !isDark"
        />
      </div>
    </UContainer>
  </header>
</template>
