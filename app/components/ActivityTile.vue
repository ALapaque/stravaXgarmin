<script setup lang="ts">
import { Activity as ActivityIcon } from 'lucide-vue-next'
import type { RunType } from '~/composables/useActivities'

const props = defineProps<{ type: RunType }>()
const color = computed(() => RUN_TYPES[props.type].color)
</script>

<template>
  <span class="tile" :style="{ '--tile': color }" aria-hidden="true">
    <ActivityIcon :size="22" />
  </span>
</template>
