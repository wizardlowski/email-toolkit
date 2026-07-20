<script lang="ts" setup>
  useHead({
    title: 'Email Toolkit'
  })

  const groups = [
    {
      title: 'Logic & Debugging',
      tools: [
        { name: 'Logik', to: '/logik', desc: 'Template logic preview and testing' },
        { name: 'Spotlight Logic Gen', to: '/spotlight-logic', desc: 'Build content objects and logic' },
      ],
    },
    {
      title: 'Text & Copy',
      tools: [
        { name: 'Legaleez', to: '/legaleez', desc: 'Wrap legal copy links' },
        { name: 'Text Compare', to: '/text-compare', desc: 'Compare blocks of text' },
        { name: 'Gradient Wrap', to: '/spectrum-wrap', desc: 'Live text gradients' },
      ],
    },
    {
      title: 'VIP',
      tools: [
        { name: 'Seesv', to: '/seesv', desc: 'CSV viewer and editor' },
        { name: 'VIPreview', to: '/vipreview', desc: 'Preview VIP newsletter from CSV' },
        { name: 'VIP Upload Helper', to: '/vip-upload-gen', desc: 'HTML generator to VIP image uploads' },
      ],
    },
    {
      title: 'Images',
      tools: [
        { name: 'Gif Fix', to: '/gif-fix', desc: 'Quick fix to reduce gif filesize' },
        { name: 'Tiny Img', to: '/tinyimg', desc: 'Compress images in-browser' },
      ],
    },
    {
      title: 'Utilities',
      tools: [
        { name: 'VIB grabber', to: '/vibgrab', desc: 'Extract VIBs from .eml files' },
        { name: 'Link Trace', to: '/linktrace', desc: 'Trace link redirect hops' },
        { name: 'Get Store Movies', to: '/get-store-movies', desc: 'Top movies for weekly trigger' },
      ],
    },
  ]
</script>

<template>
  <div class="p-4 flex flex-col gap-8 mx-auto">

    <section v-for="group in groups" :key="group.title">
      <h2 class="text-lg mb-3">{{ group.title }}</h2>

      <div class="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <NuxtLink
          v-for="tool in group.tools"
          :key="tool.to"
          :to="tool.to"
          class="block"
        >
          <UCard class="h-full transition hover:ring-2 hover:ring-primary-400 dark:hover:ring-primary-500 hover:shadow-md">
            <h3 class="font-bold font-sky-med">{{ tool.name }}</h3>
            <p class="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
              {{ tool.desc }}
            </p>
          </UCard>
        </NuxtLink>
      </div>
    </section>

  </div>
</template>

<style scoped></style>
