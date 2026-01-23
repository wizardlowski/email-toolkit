<script lang="ts" setup>
  useHead({
    title: 'Email Toolkit'
  })

  const router = useRouter()
  const routes = router.getRoutes()

  // Filter out index route as this is already the index page
  const toolsToLink = computed(() => {
    return routes.filter(r => r.path !== '/')
  })
</script>

<template>
  <div class="grid grid-cols-2 gap-4 w-[60%] max-w-3xl mx-auto p-2 items-start content-start">
    <UButton v-for="route in toolsToLink" :to="route.path" class="w-full">
      {{ route.name }}
    </UButton>
  </div>
</template>

<style scoped></style>
