<script setup lang="ts">
/*
 * Sans plan connu : nombre de courses par semaine (lundi → dimanche) sur 8 semaines. Le repère
 * « 2 courses » est tracé en pointillé ; chaque colonne porte son nombre (jamais la couleur seule).
 */
import { RUNS_PER_WEEK, type RunsWeek } from '#shared/utils/progress'

const props = defineProps<{ weeks: RunsWeek[] }>()

const max = computed(() => Math.max(...props.weeks.map((w) => w.runs), RUNS_PER_WEEK + 1))
const day = new Intl.DateTimeFormat('fr-BE', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const label = (w: RunsWeek) => {
  const d = new Date(`${w.from}T12:00:00Z`)
  return `${d.getUTCDate()}/${d.getUTCMonth() + 1}`
}
const aria = (w: RunsWeek) =>
  `Semaine du ${day.format(new Date(`${w.from}T12:00:00Z`))}${w.current ? ' (en cours)' : ''} : ${w.runs} ${w.runs > 1 ? 'courses' : 'course'}, ${formatKm(w.km)} km`
</script>

<template>
  <section class="card card--pad chart" aria-labelledby="runs-title">
    <div class="section-head">
      <h2 id="runs-title" class="eyebrow">Courses par semaine</h2>
      <span class="label">repère : {{ RUNS_PER_WEEK }}</span>
    </div>
    <ol class="bars" :style="{ '--goal': `${(RUNS_PER_WEEK / max) * 100}%` }">
      <li v-for="(w, i) in weeks" :key="w.from" class="wk" :class="{ now: w.current, ok: w.runs >= RUNS_PER_WEEK }" :style="{ '--i': i }" role="img" :aria-label="aria(w)">
        <span class="v num" aria-hidden="true">{{ w.runs || '' }}</span>
        <span class="zone" aria-hidden="true">
          <span class="b" :class="{ off: !w.runs }" :style="{ height: `${w.runs ? (w.runs / max) * 100 : 3}%` }" />
        </span>
        <span class="l" aria-hidden="true">{{ w.current ? 'en cours' : label(w) }}</span>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.chart {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.bars {
  display: grid;
  grid-template-columns: repeat(8, minmax(0, 1fr));
  gap: 6px;
  height: 160px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.wk {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.v {
  min-height: 15px;
  font-size: 12px;
  font-weight: 700;
  color: var(--ink-2);
}

.zone {
  position: relative;
  flex: 1;
  width: 100%;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

/* Repère « 2 courses » à la même hauteur dans chaque colonne */
.zone::before {
  content: '';
  position: absolute;
  left: -3px;
  right: -3px;
  bottom: var(--goal);
  border-top: 1px dashed var(--line-strong);
}

.b {
  position: relative;
  width: 100%;
  max-width: 30px;
  border-radius: calc(var(--r-ctrl) / 2 + 2px) calc(var(--r-ctrl) / 2 + 2px) 2px 2px;
  background: color-mix(in srgb, var(--type-long) 55%, transparent);
  transform-origin: bottom;
  animation: grow 0.7s var(--ease-spring) backwards;
  animation-delay: calc(150ms + var(--i) * 50ms);
}

.ok .b {
  background: var(--type-long);
}

.now .b {
  background: var(--primary);
}

.b.off {
  background: var(--line-strong);
}

.l {
  font-size: 10px;
  font-weight: 600;
  color: var(--muted);
  white-space: nowrap;
}

.now .l {
  color: var(--ink);
  font-weight: 800;
}
</style>
