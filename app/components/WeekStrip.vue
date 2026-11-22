<script setup lang="ts">
/*
 * « Ta semaine » : sept jours du lundi au dimanche, lisibles d'un coup d'œil, reliés par un fil.
 * Course faite : pastille pleine de la couleur du type (et ses kilomètres) ; séance prévue : anneau ;
 * séance sautée : croix discrète ; rien : un point. Aujourd'hui est repéré. Chaque état a aussi un mot
 * (jamais la couleur seule). Dessous : séances faites sur prévues (ou nombre de courses sans plan),
 * kilomètres, temps, et l'écart avec la semaine passée. Données : weekView() (shared/utils/today.ts).
 */
import { X } from 'lucide-vue-next'
import type { RunType } from '#shared/utils/runs'
import type { WeekView } from '#shared/utils/today'

const props = defineProps<{ week: WeekView }>()

const letter = new Intl.DateTimeFormat('fr-BE', { weekday: 'narrow', timeZone: 'UTC' })
const long = new Intl.DateTimeFormat('fr-BE', { weekday: 'long', day: 'numeric', timeZone: 'UTC' })
const short = new Intl.DateTimeFormat('fr-BE', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const at = (d: string) => new Date(`${d}T12:00:00Z`)

const range = computed(() => {
  const a = at(props.week.from)
  const b = at(props.week.to)
  return a.getUTCMonth() === b.getUTCMonth() ? `${a.getUTCDate()} – ${short.format(b)}` : `${short.format(a)} – ${short.format(b)}`
})
const todayIndex = computed(() => Math.max(props.week.days.findIndex((d) => d.isToday), 0))
const color = (t: string | undefined) => (t ? RUN_TYPES[t as RunType]?.color : undefined) ?? 'var(--accent-text)'
const kmShort = (km: number) => km.toLocaleString('fr-BE', { maximumFractionDigits: km >= 10 ? 0 : 1 })

const STATE_WORD = { done: 'course', planned: 'séance prévue', skipped: 'séance sautée', rest: 'rien' } as const
function ariaDay(d: WeekView['days'][number]) {
  const what = d.state === 'done' ? `${d.runs.length > 1 ? `${d.runs.length} courses` : 'course'}, ${formatKm(d.km)} km` : STATE_WORD[d.state]
  return `${long.format(at(d.date))}${d.isToday ? ' (aujourd’hui)' : ''} : ${what}`
}

const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`
const delta = computed(() => {
  const w = props.week
  if (!w.km && !w.previousKm) return ''
  const when = w.fullWeek ? 'la semaine passée' : 'la semaine passée à la même date'
  if (Math.abs(w.deltaKm) < 0.05) return `Autant que ${when}`
  return `${w.deltaKm > 0 ? '+' : '−'}${formatKm(Math.abs(w.deltaKm))} km par rapport à ${when}`
})
</script>

<template>
  <section class="card week" aria-labelledby="week-title">
    <header class="head">
      <h2 id="week-title" class="h2">Ta semaine</h2>
      <span class="label">{{ range }}</span>
    </header>

    <ol class="days" :style="{ '--t': todayIndex }">
      <li
        v-for="(d, i) in week.days"
        :key="d.date"
        class="day"
        :class="[`is-${d.state}`, { 'is-today': d.isToday, 'is-future': d.isFuture }]"
        :style="{ '--c': color(d.runs[0]?.type), '--d': i }"
        :aria-label="ariaDay(d)"
      >
        <span class="letter" aria-hidden="true">{{ letter.format(at(d.date)) }}</span>
        <span class="glyph" aria-hidden="true">
          <X v-if="d.state === 'skipped'" :size="14" :stroke-width="2.5" />
        </span>
        <span class="sub" aria-hidden="true">
          <template v-if="d.state === 'done'">{{ kmShort(d.km) }}</template>
          <template v-else-if="d.state === 'planned'">prévue</template>
          <template v-else-if="d.state === 'skipped'">sautée</template>
          <template v-else-if="d.isToday">auj.</template>
        </span>
      </li>
    </ol>

    <div class="foot">
      <p class="sum">
        <template v-if="week.planned">
          <strong class="num big">{{ week.doneSessions }}</strong>
          <span>{{ week.planned > 1 ? 'séances' : 'séance' }} sur {{ week.planned }}</span>
        </template>
        <template v-else>
          <strong class="num big">{{ week.runs }}</strong>
          <span>{{ week.runs > 1 ? 'courses' : 'course' }}</span>
        </template>
        <span class="dotsep" aria-hidden="true" />
        <strong class="num">{{ formatKm(week.km) }}</strong><span>km</span>
        <template v-if="week.sec">
          <span class="dotsep" aria-hidden="true" />
          <strong class="num">{{ formatHours(week.sec) }}</strong>
        </template>
      </p>
      <p v-if="delta" class="fine">{{ delta }}</p>
      <p v-else class="fine">{{ week.planned ? plural(week.planned, 'séance prévue', 'séances prévues') : 'Pas encore de course cette semaine' }}</p>
    </div>
  </section>
</template>

<style scoped>
.week {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 18px 16px 18px;
}

.head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding-inline: 4px;
}

.days {
  --glyph: 30px;
  --top: 26px;
  position: relative;
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  margin: 0;
  padding: 0;
  list-style: none;
}

/* Le fil qui relie les jours : plein jusqu'à aujourd'hui, en pointillé ensuite */
.days::before,
.days::after {
  content: '';
  position: absolute;
  left: calc(100% / 14);
  top: calc(var(--top) + var(--glyph) / 2 - 1px);
  height: 2px;
}

.days::before {
  right: calc(100% / 14);
  background: repeating-linear-gradient(90deg, var(--line-strong) 0 4px, transparent 4px 9px);
}

.days::after {
  width: calc(var(--t) / 7 * 100%);
  background: var(--line-strong);
  transform-origin: left;
  animation: thread-in 0.9s var(--ease-out) 0.2s backwards;
}

@keyframes thread-in {
  from {
    transform: scaleX(0);
  }
}

.day {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-rows: var(--top) var(--glyph) auto;
  justify-items: center;
  align-items: center;
  padding-bottom: 6px;
  border-radius: var(--r-ctrl);
}

/* Aujourd'hui : une colonne éclairée */
.day.is-today {
  background: linear-gradient(180deg, color-mix(in srgb, var(--accent-text) 14%, transparent), transparent 92%);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent-text) 30%, transparent);
}

.letter {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
}

.is-today .letter {
  color: var(--accent-text);
}

.glyph {
  display: grid;
  place-items: center;
  width: var(--glyph);
  height: var(--glyph);
  border-radius: 50%;
  animation: pop 0.55s var(--ease-spring) backwards;
  animation-delay: calc(220ms + var(--d) * 50ms);
}

/* Rien : un simple point, sur le fil */
.is-rest .glyph {
  width: 8px;
  height: 8px;
  background: var(--line-strong);
}

/* Course faite : pastille pleine de la couleur du type */
.is-done .glyph {
  background: radial-gradient(circle at 35% 30%, color-mix(in srgb, var(--c) 70%, var(--ink)), var(--c) 70%);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--c) 22%, transparent), 0 0 16px color-mix(in srgb, var(--c) 55%, transparent);
}

/* Séance prévue : anneau (qui respire si c'est aujourd'hui) */
.is-planned .glyph {
  background: var(--surface-2);
  box-shadow: inset 0 0 0 2.5px var(--accent-text);
}

.is-today.is-planned .glyph {
  animation: pop 0.55s var(--ease-spring) backwards, breathe 2.4s ease-in-out 1s infinite;
  animation-delay: calc(220ms + var(--d) * 50ms), 1s;
}

@keyframes breathe {
  50% {
    box-shadow: inset 0 0 0 2.5px var(--accent-text), 0 0 0 6px color-mix(in srgb, var(--accent-text) 18%, transparent);
  }
}

/* Séance sautée : croix discrète dans un cercle en pointillé */
.is-skipped .glyph {
  color: var(--muted);
  background: var(--surface-2);
  border: 1.5px dashed var(--line-strong);
}

.sub {
  min-height: 16px;
  margin-top: 6px;
  font-size: 11px;
  font-weight: 600;
  color: var(--muted);
  white-space: nowrap;
}

.is-done .sub {
  font-family: var(--font-display);
  font-weight: var(--display-weight);
  font-size: 13px;
  color: var(--ink);
  font-variant-numeric: tabular-nums;
}

.is-planned .sub {
  color: var(--accent-text);
}

.foot {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 14px 4px 0;
  border-top: 1px solid var(--line);
}

.sum {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 6px;
  margin: 0;
  color: var(--ink-2);
  font-size: 14px;
}

.sum strong {
  color: var(--ink);
  font-size: 17px;
}

.sum .big {
  font-size: 26px;
}

.dotsep {
  width: 3px;
  height: 3px;
  margin: 0 4px;
  border-radius: 50%;
  background: var(--muted);
  align-self: center;
}

@media (min-width: 720px) {
  .week {
    padding: 22px 20px;
  }

  .days {
    --glyph: 36px;
  }

  .is-done .sub {
    font-size: 14px;
  }
}
</style>
