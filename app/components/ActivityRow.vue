<script setup lang="ts">
import type { Activity } from '~/composables/useActivities'

const props = defineProps<{ activity: Activity }>()
const { isSynced } = useActivities()
const { recordsOf } = useRecords()
const a = computed(() => props.activity)
const record = computed(() => recordsOf(a.value)[0])
</script>

<template>
  <NuxtLink :to="`/activites/${a.id}`" class="row">
    <ActivityTile :type="a.type" />
    <span class="row__main">
      <span class="title">{{ a.garminName }}</span>
      <span class="label">
        {{ formatKm(a.distanceKm) }} km · {{ formatDuration(a.durationSec) }}<span v-if="record" class="rec"> · Record {{ record.label }}</span>
      </span>
    </span>
    <StatusChip :ok="isSynced(a)" />
  </NuxtLink>
</template>

<style scoped>
.rec {
  color: var(--ok);
}
</style>
