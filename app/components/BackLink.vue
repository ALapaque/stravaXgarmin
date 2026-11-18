<script setup lang="ts">
import { ChevronLeft } from 'lucide-vue-next'

defineProps<{ to: string; label: string }>()
</script>

<template>
  <NuxtLink :to="to" class="back">
    <ChevronLeft :size="22" aria-hidden="true" />
    <span>{{ label }}</span>
  </NuxtLink>
</template>

<style scoped>
.back {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  align-self: flex-start;
  min-height: 44px;
  padding-right: 12px;
  font-weight: 600;
  color: var(--ink-2);
}
</style>
