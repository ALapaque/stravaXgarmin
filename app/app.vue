<script setup lang="ts">
const { theme, current } = useTheme()

useHead({
  htmlAttrs: { 'data-theme': theme },
  meta: [{ name: 'theme-color', content: () => current.value.bg }],
})
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
