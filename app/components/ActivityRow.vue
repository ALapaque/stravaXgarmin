<script setup lang="ts">
import { ChevronRight } from 'lucide-vue-next'
import type { Activity } from '~/composables/useActivities'

const props = defineProps<{ activity: Activity }>()
const { recordsOf } = useRecords()
const { toDebrief } = useDebriefs()
const a = computed(() => props.activity)
const todo = computed(() => toDebrief.value.some((x) => x.id === a.value.id))
const record = computed(() => recordsOf(a.value)[0])
const shortDate = new Intl.DateTimeFormat('fr-BE', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/Brussels' })
</script>

<template>
  <NuxtLink :to="`/activites/${a.id}`" class="row act">
    <span class="thumb" :style="{ '--c': RUN_TYPES[a.type].color }">
      <RouteTrace :activity="a" :draw="false" :glow="false" :width="5" />
    </span>
    <span class="row__main">
      <span class="title">{{ displayTitle(a).title }}</span>
      <span class="meta">
        <span>{{ shortDate.format(new Date(a.startedAt)) }}</span>
        <span class="num-s">{{ formatKm(a.distanceKm) }} km</span>
        <span class="num-s">{{ formatPace(a.durationSec, a.distanceKm) }}/km</span>
      </span>
      <span v-if="record || todo || a.indoor" class="tags">
        <!-- Sur tapis : le lieu est une étiquette, pour garder la ligne des chiffres sur une seule ligne -->
        <span v-if="a.indoor" class="tag tag--place">{{ placeLabel(a) }}</span>
        <span v-if="record" class="tag tag--rec">Record {{ record.label }}</span>
        <span v-if="todo" class="tag tag--todo">À débriefer</span>
      </span>
    </span>
    <ChevronRight class="go" :size="18" aria-hidden="true" />
  </NuxtLink>
</template>

<style scoped>
.act {
  gap: 14px;
  padding: 12px 14px;
}

.thumb {
  flex-shrink: 0;
  width: 56px;
  height: 56px;
  padding: 7px;
  border-radius: var(--r-ctrl);
  background:
    radial-gradient(circle at 30% 20%, color-mix(in srgb, var(--c) 22%, transparent), transparent 70%),
    var(--surface-2);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--c) 25%, transparent);
}

.meta {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 10px;
  white-space: nowrap;
  font-size: 13px;
  color: var(--muted);
}

.num-s {
  font-variant-numeric: tabular-nums;
  color: var(--ink-2);
  font-weight: 600;
}

.tags {
  display: flex;
  gap: 6px;
  margin-top: 4px;
}

.tag {
  padding: 2px 8px;
  border-radius: 99px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.tag--rec {
  color: var(--ok);
  background: color-mix(in srgb, var(--ok) 15%, transparent);
}

.tag--place {
  color: var(--ink-2);
  background: var(--surface-2);
}

.tag--todo {
  color: var(--accent-text);
  background: color-mix(in srgb, var(--accent-text) 15%, transparent);
}

.go {
  flex-shrink: 0;
  color: var(--muted);
  transition: transform 0.2s var(--ease-out);
}

.act:hover .go {
  transform: translateX(3px);
}
</style>
