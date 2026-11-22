<script setup lang="ts">
/*
 * Une course dans une liste : vignette (tracé dehors, profil des tours sinon), titre affiché, chiffres,
 * et ses pastilles : « À débriefer », issue du débrief (« Faite », « Écourtée », « Ratée »),
 * « Record … », lieu (« Tapis ») et source du titre en discret.
 */
import { ChevronRight, CircleCheckBig, CircleDotDashed, CircleX } from 'lucide-vue-next'
import type { Activity } from '~/composables/useActivities'

const props = defineProps<{ activity: Activity }>()
const { recordsOf } = useRecords()
const { toDebrief, get } = useDebriefs()
const convention = useConvention()
const a = computed(() => props.activity)
const todo = computed(() => toDebrief.value.some((x) => x.id === a.value.id))
const record = computed(() => recordsOf(a.value)[0])
const title = computed(() => displayTitle(a.value))
const sources = computed(() => title.value.tags.filter((t) => t !== convention.failTag.value))
const debrief = computed(() => get(a.value.id))
/** Issue choisie dans le débrief (seulement une fois fait) */
const outcome = computed(() => (debrief.value?.status === 'done' ? debrief.value.outcome : null))
/** Ratée : étiquette d'échec dans le titre, ou issue du débrief */
const failed = computed(() => title.value.tags.includes(convention.failTag.value) || outcome.value === 'failed')
const shortDate = new Intl.DateTimeFormat('fr-BE', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/Brussels' })
</script>

<template>
  <NuxtLink :to="`/activites/${a.id}`" class="row act">
    <span class="thumb" :style="{ '--c': RUN_TYPES[a.type].color }">
      <RunThumb :activity="a" />
    </span>
    <span class="row__main">
      <span class="title">{{ title.title }}</span>
      <span class="meta">
        <span>{{ shortDate.format(new Date(a.startedAt)) }}</span>
        <span class="num-s">{{ formatKm(a.distanceKm) }} km</span>
        <span class="num-s">{{ formatPace(a.durationSec, a.distanceKm) }}/km</span>
      </span>
      <span v-if="todo || failed || outcome || record || a.indoor || sources.length" class="tags">
        <span v-if="todo" class="tag tag--todo">À débriefer</span>
        <span v-if="failed" class="tag tag--fail"><CircleX :size="12" aria-hidden="true" />Ratée</span>
        <span v-else-if="outcome" class="tag tag--out" :class="`tag--${outcome}`">
          <component :is="outcome === 'done' ? CircleCheckBig : CircleDotDashed" :size="12" aria-hidden="true" />{{ OUTCOME_LABELS[outcome] }}
        </span>
        <span v-if="record" class="tag tag--rec">Record {{ record.label }}</span>
        <!-- Sur tapis : le lieu est une étiquette, pour garder la ligne des chiffres sur une seule ligne -->
        <span v-if="a.indoor" class="tag tag--place">{{ placeLabel(a) }}</span>
        <span v-for="s in sources" :key="s" class="tag tag--src">{{ s }}</span>
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
  padding: 9px 8px;
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
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 5px;
}

.tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: var(--r-pill);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.02em;
  white-space: nowrap;
}

.tag--rec {
  color: var(--ok);
  background: color-mix(in srgb, var(--ok) 15%, transparent);
}

.tag--place {
  color: var(--ink-2);
  background: var(--surface-2);
}

/* Source du titre : discrète */
.tag--src {
  font-family: var(--font-mono);
  font-weight: 600;
  color: var(--muted);
  box-shadow: inset 0 0 0 1px var(--line);
}

.tag--todo {
  color: var(--accent-text);
  background: color-mix(in srgb, var(--accent-text) 15%, transparent);
}

.tag--fail {
  color: var(--ko);
  background: color-mix(in srgb, var(--ko) 15%, transparent);
}

.tag--out {
  padding-left: 0;
  color: var(--ink-2);
}

.tag--done svg {
  color: var(--ok);
}

.tag--short svg {
  color: var(--accent-text);
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
