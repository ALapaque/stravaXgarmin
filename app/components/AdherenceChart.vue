<script setup lang="ts">
/*
 * Plan suivi semaine par semaine : une colonne par semaine (lundi → dimanche), empilée de bas en haut
 * en séances faites, écourtées, ratées, sautées. Jamais la couleur seule : chaque issue a sa matière
 * (plein, rayé, plein, hachuré en pointillé), la légende donne les totaux, chaque colonne a son libellé
 * « faites / prévues », son détail au survol et au focus, et une phrase complète pour les lecteurs d'écran.
 */
import type { AdherenceWeek } from '#shared/utils/planmatch'

const props = defineProps<{ weeks: AdherenceWeek[] }>()

const KINDS = [
  { key: 'done', label: 'Faites' },
  { key: 'short', label: 'Écourtées' },
  { key: 'failed', label: 'Ratées' },
  { key: 'skipped', label: 'Sautées' },
] as const

const max = computed(() => Math.max(...props.weeks.map((w) => w.planned), 1))
const totals = computed(() => Object.fromEntries(KINDS.map((k) => [k.key, props.weeks.reduce((s, w) => s + w[k.key], 0)])) as Record<(typeof KINDS)[number]['key'], number>)
const day = new Intl.DateTimeFormat('fr-BE', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const label = (w: AdherenceWeek) => {
  const d = new Date(`${w.from}T12:00:00Z`)
  return `${d.getUTCDate()}/${d.getUTCMonth() + 1}`
}
const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`
function detail(w: AdherenceWeek) {
  if (!w.planned) return 'Aucune séance prévue'
  return KINDS.filter((k) => w[k.key]).map((k) => `${w[k.key]} ${k.label.toLowerCase().replace(/s$/, w[k.key] > 1 ? 's' : '')}`).join(' · ')
}
const aria = (w: AdherenceWeek, current: boolean) =>
  `Semaine du ${day.format(new Date(`${w.from}T12:00:00Z`))}${current ? ' (en cours)' : ''} : ${w.planned ? `${w.done} sur ${plural(w.planned, 'séance prévue', 'séances prévues')}, ${detail(w)}` : 'aucune séance prévue'}`
</script>

<template>
  <section class="card card--pad chart" aria-labelledby="adh-title">
    <div class="section-head">
      <h2 id="adh-title" class="eyebrow">Semaine par semaine</h2>
      <span class="label">faites / prévues</span>
    </div>

    <ol class="cols-chart">
      <li
        v-for="(w, i) in weeks"
        :key="w.from"
        class="wk"
        :class="{ now: i === weeks.length - 1, empty: !w.planned }"
        :style="{ '--i': i }"
        tabindex="0"
        role="img"
        :aria-label="aria(w, i === weeks.length - 1)"
      >
        <span class="tot num" aria-hidden="true">{{ w.planned ? `${w.done}/${w.planned}` : '–' }}</span>
        <span class="zone" aria-hidden="true">
          <span class="stack-bar" :style="{ height: `${(Math.max(w.planned, 0) / max) * 100}%` }">
            <template v-for="k in KINDS" :key="k.key">
              <span v-if="w[k.key]" class="seg" :class="`seg--${k.key}`" :style="{ flexGrow: w[k.key] }" />
            </template>
          </span>
          <span v-if="!w.planned" class="none" />
        </span>
        <span class="l" aria-hidden="true">{{ i === weeks.length - 1 ? 'en cours' : label(w) }}</span>
        <span class="tip card" aria-hidden="true">
          <strong>Semaine du {{ day.format(new Date(`${w.from}T12:00:00Z`)) }}</strong>
          <span>{{ detail(w) }}</span>
        </span>
      </li>
    </ol>

    <ul class="legend">
      <li v-for="k in KINDS" :key="k.key">
        <span class="sw seg" :class="`seg--${k.key}`" aria-hidden="true" />
        {{ k.label }}
        <strong class="num">{{ totals[k.key] }}</strong>
      </li>
    </ul>

  </section>
</template>

<style scoped>
.chart {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.cols-chart {
  position: relative;
  display: grid;
  grid-template-columns: repeat(8, minmax(0, 1fr));
  gap: 6px;
  height: 176px;
  margin: 0;
  padding: 0;
  list-style: none;
  /* Lignes de repère discrètes */
  background: linear-gradient(var(--line), var(--line)) 0 calc(100% - 22px) / 100% 1px no-repeat;
}

.wk {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  min-width: 0;
  height: 100%;
  border-radius: var(--r-ctrl);
  outline: none;
}

.wk:focus-visible {
  box-shadow: 0 0 0 2px var(--focus);
}

.tot {
  font-size: 11px;
  font-weight: 700;
  color: var(--ink-2);
  white-space: nowrap;
}

.empty .tot {
  color: var(--muted);
}

.zone {
  flex: 1;
  width: 100%;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  min-height: 0;
}

.stack-bar {
  display: flex;
  flex-direction: column-reverse;
  gap: 2px;
  width: 100%;
  max-width: 30px;
  transform-origin: bottom;
  animation: grow 0.7s var(--ease-spring) backwards;
  animation-delay: calc(160ms + var(--i) * 55ms);
}

.seg {
  display: block;
  min-height: 6px;
  flex-basis: 0;
  border-radius: 2px;
}

/* Le haut de la colonne est arrondi, le pied reste posé sur la ligne de base */
.stack-bar > .seg:last-child {
  border-top-left-radius: calc(var(--r-ctrl) / 2 + 2px);
  border-top-right-radius: calc(var(--r-ctrl) / 2 + 2px);
}

.seg--done {
  background: var(--ok);
}

/* Écourtée : rayée (lisible sans la couleur, et distincte de « ratée ») */
.seg--short {
  background:
    repeating-linear-gradient(135deg, var(--accent-text) 0 3px, color-mix(in srgb, var(--accent-text) 45%, transparent) 3px 6px);
}

.seg--failed {
  background: var(--ko);
}

/* Sautée : creuse, contour en pointillé et hachures fines */
.seg--skipped {
  background: repeating-linear-gradient(45deg, color-mix(in srgb, var(--muted) 55%, transparent) 0 1px, transparent 1px 5px);
  box-shadow: inset 0 0 0 1.5px var(--muted);
  outline: 1px dashed transparent;
}

.none {
  width: 100%;
  max-width: 30px;
  height: 3px;
  border-radius: 2px;
  background: var(--line-strong);
}

.now .stack-bar {
  filter: drop-shadow(0 0 10px color-mix(in srgb, var(--ok) 45%, transparent));
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

/* Détail au survol / au focus */
.tip {
  position: absolute;
  bottom: calc(100% - 4px);
  left: 50%;
  z-index: 3;
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: max-content;
  max-width: 180px;
  padding: 8px 10px;
  border-radius: var(--r-ctrl);
  font-size: 12px;
  color: var(--ink-2);
  opacity: 0;
  pointer-events: none;
  transform: translate(-50%, 4px);
  transition: opacity 0.15s ease, transform 0.2s var(--ease-out);
}

.tip strong {
  color: var(--ink);
}

.wk:first-child .tip,
.wk:nth-child(2) .tip {
  left: 0;
  transform: translate(0, 4px);
}

.wk:last-child .tip,
.wk:nth-last-child(2) .tip {
  left: auto;
  right: 0;
  transform: translate(0, 4px);
}

.wk:hover .tip,
.wk:focus-visible .tip {
  opacity: 1;
  transform: translate(-50%, 0);
}

.wk:first-child:hover .tip,
.wk:first-child:focus-visible .tip,
.wk:nth-child(2):hover .tip,
.wk:nth-child(2):focus-visible .tip,
.wk:last-child:hover .tip,
.wk:last-child:focus-visible .tip,
.wk:nth-last-child(2):hover .tip,
.wk:nth-last-child(2):focus-visible .tip {
  transform: translate(0, 0);
}

.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 13px;
  color: var(--ink-2);
}

.legend li {
  display: inline-flex;
  align-items: center;
  gap: 7px;
}

.legend strong {
  font-size: 13px;
  color: var(--ink);
}

.sw {
  width: 12px;
  height: 12px;
  min-height: 0;
  border-radius: 3px;
}
</style>
