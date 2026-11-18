<script setup lang="ts">
const { theme, current, style } = useTheme()

useHead({
  htmlAttrs: { 'data-theme': theme, style },
  meta: [{ name: 'theme-color', content: () => current.value.bg }],
})
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
  <UpdateDialog />
</template>
