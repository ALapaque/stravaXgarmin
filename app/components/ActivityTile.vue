<script setup lang="ts">
/*
 * Tuile d'une course ou d'un type de séance (44 px). Avec la course : sa vignette (tracé dehors,
 * mini-profil des tours sinon, voir RunThumb) ; avec le type seul : son pictogramme.
 */
import { Activity as ActivityIcon } from 'lucide-vue-next'
import type { Activity, RunType } from '~/composables/useActivities'

const props = defineProps<{ type: RunType; activity?: Activity | null }>()
const color = computed(() => RUN_TYPES[props.activity?.type ?? props.type].color)
</script>

<template>
  <span class="tile" :class="{ 'tile--run': activity }" :style="{ '--tile': color }" aria-hidden="true">
    <RunThumb v-if="activity" :activity="activity" :width="6" />
    <ActivityIcon v-else :size="22" />
  </span>
</template>

<style scoped>
.tile--run {
  padding: 7px;
}
</style>
