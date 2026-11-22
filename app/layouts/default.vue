<script setup lang="ts">
// Écran de concentration (definePageMeta({ focus: true }), ex. le Débrief) : pas de barre du bas
const route = useRoute()
const focus = computed(() => route.meta.focus === true)
</script>

<template>
  <div class="app app--nav" :class="{ 'app--focus': focus }">
    <AppAurora />
    <DemoBanner />
    <AppSidebar />
    <main class="screen">
      <slot />
    </main>
    <AppTabBar v-if="!focus" />
    <AppToast />
  </div>
</template>
