<script setup lang="ts">
/*
 * La séance réalisée, tour par tour : une barre par tour (largeur = durée, hauteur = vitesse),
 * colorée par nature d'étape quand la séance est reliée (sinon par intensité, dans la teinte du type),
 * les étapes pas faites en fantômes hachurés, et la courbe de cardio par-dessus dès qu'elle est chargée.
 * Toucher, survoler ou parcourir au clavier (flèches) une barre affiche ses chiffres sous le graphique.
 * Géométrie : shared/utils/runchart.ts (lapProfile, lapDetail, timeTicks, seriesPath).
 */
import type { Lap, StepResult } from '#shared/utils/compliance'
import type { LapBar } from '#shared/utils/runchart'
import type { RunStream } from '#shared/utils/streams'

const props = withDefaults(
  defineProps<{ laps: Lap[] | null | undefined; steps?: StepResult[] | null; stream?: RunStream | null; color?: string; height?: number }>(),
  { steps: null, stream: null, color: 'var(--accent-text)', height: 176 },
)

const KIND_COLORS: Record<string, string> = {
  warmup: 'var(--info)',
  cooldown: 'var(--info)',
  interval: 'var(--accent-text)',
  recovery: 'var(--ok)',
  rest: 'var(--muted)',
  other: 'var(--type-long)',
}
/** Intensité (sans séance reliée) : une seule teinte, de plus en plus franche */
const TIER_MIX = [38, 58, 78, 100]

const uid = useId()
const p = computed(() => lapProfile(props.laps, props.steps))
const bars = computed(() => p.value.bars)
const ticks = computed(() => timeTicks(p.value.total))

const colorOf = (b: LapBar) => {
  if (p.value.linked) return b.kind ? KIND_COLORS[b.kind] : 'var(--muted)'
  return `color-mix(in oklab, ${props.color} ${TIER_MIX[b.tier]}%, transparent)`
}

/* Cardio par-dessus : échelle propre, sans graduation (les valeurs se lisent dans le détail) */
const W = 1000
const H = 100
const hr = computed(() => {
  const s = props.stream
  const b = hrBounds(s?.hr)
  if (!s || !b) return null
  // La courbe occupe le haut du graphique, au-dessus des barres lentes
  const span = b.hi - b.lo
  const scale = { total: p.value.total, lo: b.lo - span * 0.15, hi: b.hi + span * 0.05, w: W, h: H }
  return { path: seriesPath(s.t, s.hr, scale).line, scale }
})

/* ───── Sélection ───── */

const sel = ref<number | null>(null)
const pinned = ref<number | null>(null)
const current = computed(() => (sel.value !== null ? bars.value[sel.value] ?? null : null))

const hrDot = computed(() => {
  const b = current.value
  const h = hr.value
  if (!b || !h || b.state === 'missed') return null
  const mid = b.t0 + b.sec / 2
  const v = valueAt(props.stream?.t, props.stream?.hr, mid)
  if (v === null) return null
  const { lo, hi } = h.scale
  return { x: mid / p.value.total, y: 1 - (Math.min(Math.max(v, lo), hi) - lo) / (hi - lo) }
})

const plot = ref<HTMLElement>()
function barAt(e: PointerEvent) {
  const el = plot.value
  if (!el) return null
  const r = el.getBoundingClientRect()
  const t = ((e.clientX - r.left) / r.width) * p.value.total
  const i = bars.value.findIndex((b) => t >= b.t0 && t < b.t0 + b.sec)
  return i >= 0 ? i : t >= p.value.total ? bars.value.length - 1 : 0
}
function onMove(e: PointerEvent) {
  if (e.pointerType !== 'mouse') return
  sel.value = barAt(e)
}
function onLeave(e: PointerEvent) {
  if (e.pointerType === 'mouse') sel.value = pinned.value
}
function onDown(e: PointerEvent) {
  const i = barAt(e)
  // Toucher à nouveau la barre choisie la relâche
  pinned.value = pinned.value === i && e.pointerType !== 'mouse' ? null : i
  sel.value = pinned.value
}
function onKey(e: KeyboardEvent) {
  const n = bars.value.length
  if (!n) return
  const at = sel.value ?? -1
  let next: number | null = at
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = Math.min(n - 1, at + 1)
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = Math.max(0, at < 0 ? 0 : at - 1)
  else if (e.key === 'Home') next = 0
  else if (e.key === 'End') next = n - 1
  else if (e.key === 'Escape') next = null
  else return
  e.preventDefault()
  sel.value = pinned.value = next
}
function onFocus() {
  if (sel.value === null && bars.value.length) sel.value = pinned.value = 0
}

/** « Effort 3 » en gras, puis ses chiffres */
const detailParts = computed(() => {
  const t = current.value ? lapDetail(current.value) : ''
  const k = t.indexOf(' · ')
  return k < 0 ? { head: t, rest: '' } : { head: t.slice(0, k), rest: t.slice(k + 3) }
})

const doneCount = computed(() => bars.value.filter((b) => b.lap >= 0).length)
const hint = computed(() => `${doneCount.value} tour${doneCount.value > 1 ? 's' : ''} · touche une barre pour le détail`)

/* ───── Légende : jamais la couleur seule ───── */
const legend = computed(() => {
  if (!p.value.linked) return []
  const kinds = new Set(bars.value.filter((b) => b.state !== 'missed').map((b) => b.kind))
  const out: { key: string; label: string; color: string }[] = []
  if (kinds.has('warmup') || kinds.has('cooldown'))
    out.push({ key: 'calm', label: kinds.has('warmup') && kinds.has('cooldown') ? 'Échauffement, retour au calme' : kinds.has('warmup') ? 'Échauffement' : 'Retour au calme', color: KIND_COLORS.warmup! })
  if (kinds.has('interval')) out.push({ key: 'interval', label: 'Effort', color: KIND_COLORS.interval! })
  if (kinds.has('recovery') || kinds.has('rest')) out.push({ key: 'recovery', label: 'Récup', color: KIND_COLORS.recovery! })
  if (kinds.has('other')) out.push({ key: 'other', label: 'Course', color: KIND_COLORS.other! })
  if (kinds.has(null)) out.push({ key: 'none', label: 'Hors séance', color: 'var(--muted)' })
  return out
})
const hasMissed = computed(() => bars.value.some((b) => b.state === 'missed'))
const hasPartial = computed(() => bars.value.some((b) => b.state === 'partial'))

const summary = computed(() => {
  const n = doneCount.value
  const missed = bars.value.filter((b) => b.state === 'missed').length
  return `Profil de la séance : ${n} tour${n > 1 ? 's' : ''}${missed ? `, ${missed} étape${missed > 1 ? 's' : ''} prévue${missed > 1 ? 's' : ''} pas faite${missed > 1 ? 's' : ''}` : ''}. Flèches gauche et droite pour parcourir les tours.`
})
</script>

<template>
  <figure class="lp" :style="{ '--plot-h': `${height}px` }">
    <div
      ref="plot"
      class="plot"
      :class="{ 'has-sel': current }"
      tabindex="0"
      role="listbox"
      :aria-label="summary"
      :aria-activedescendant="current ? `${uid}-${sel}` : undefined"
      @pointermove="onMove"
      @pointerleave="onLeave"
      @pointerdown="onDown"
      @keydown="onKey"
      @focus="onFocus"
    >
      <span v-for="t in ticks" :key="t.t" class="gridline" :style="{ left: `${t.x * 100}%` }" aria-hidden="true" />
      <div
        v-for="(b, i) in bars"
        :id="`${uid}-${i}`"
        :key="i"
        class="bar"
        :class="[b.state, { sel: sel === i }]"
        role="option"
        :aria-selected="sel === i"
        :aria-label="lapDetail(b)"
        :style="{
          left: `${(b.t0 / p.total) * 100}%`,
          width: `max(3px, ${(b.sec / p.total) * 100}%)`,
          '--h': `${Math.round(b.level * 100)}%`,
          '--c': colorOf(b),
          '--i': i,
        }"
      >
        <span class="fill" />
      </div>
      <svg v-if="hr?.path" class="hr" :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="none" aria-hidden="true">
        <path class="hr-halo" :d="hr.path" vector-effect="non-scaling-stroke" />
        <path class="hr-line" :d="hr.path" vector-effect="non-scaling-stroke" />
      </svg>
      <span v-if="current" class="guide" :style="{ left: `${((current.t0 + current.sec / 2) / p.total) * 100}%` }" aria-hidden="true" />
      <span v-if="hrDot" class="hr-dot" :style="{ left: `${hrDot.x * 100}%`, top: `${hrDot.y * 100}%` }" aria-hidden="true" />
    </div>

    <div class="axis" aria-hidden="true">
      <span v-for="t in ticks" :key="t.t" class="tick" :style="{ left: `${t.x * 100}%` }">{{ t.label }}</span>
    </div>

    <p class="readout" :class="{ on: current }" aria-live="polite">
      <template v-if="current">
        <span class="sw" :class="current.state" :style="{ '--c': colorOf(current) }" aria-hidden="true" />
        <span><strong>{{ detailParts.head }}</strong><template v-if="detailParts.rest"> · {{ detailParts.rest }}</template></span>
      </template>
      <template v-else>{{ hint }}</template>
    </p>

    <figcaption class="legend">
      <span v-for="l in legend" :key="l.key" class="lg"><span class="sw" :style="{ '--c': l.color }" aria-hidden="true" />{{ l.label }}</span>
      <span v-if="hasPartial" class="lg"><span class="sw partial" :style="{ '--c': 'var(--accent-text)' }" aria-hidden="true" />Entamé</span>
      <span v-if="hasMissed" class="lg"><span class="sw missed" aria-hidden="true" />Pas fait</span>
      <span v-if="hr?.path" class="lg"><span class="sw sw--line" aria-hidden="true" />Cardio</span>
      <span class="lg lg--hint">Plus haut = plus rapide</span>
    </figcaption>
  </figure>
</template>

<style scoped>
.lp {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  min-width: 0;
}

.plot {
  position: relative;
  height: var(--plot-h);
  border-bottom: 1px solid var(--line-strong);
  outline: none;
  touch-action: pan-y;
  cursor: crosshair;
}

.plot:focus-visible {
  box-shadow: 0 0 0 2px var(--focus, var(--accent-text));
  border-radius: calc(var(--r-ctrl) * 0.5);
}

.gridline {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 0;
  border-left: 1px dashed var(--line);
  pointer-events: none;
}

.bar {
  position: absolute;
  top: 0;
  bottom: 0;
  pointer-events: none;
  transition: opacity 0.18s ease;
}

.fill {
  position: absolute;
  left: 0.75px;
  right: 0.75px;
  bottom: 0;
  height: var(--h);
  border-radius: calc(var(--r-ctrl) * 0.28) calc(var(--r-ctrl) * 0.28) 0 0;
  background: linear-gradient(180deg, var(--c), color-mix(in srgb, var(--c) 30%, transparent));
  transform-origin: bottom;
  animation: grow 0.65s var(--ease-spring) backwards;
  animation-delay: calc(160ms + var(--i) * 16ms);
}

/* Entamé puis arrêté : la couleur, rayée */
.partial .fill {
  background: repeating-linear-gradient(135deg, var(--c) 0 2px, color-mix(in srgb, var(--c) 35%, transparent) 2px 5px);
}

/* Prévu, pas fait : fantôme hachuré, sans couleur */
.missed .fill {
  background: repeating-linear-gradient(135deg, var(--line-strong) 0 1.5px, transparent 1.5px 5px);
  box-shadow: inset 0 0 0 1px var(--line-strong);
}

.has-sel .bar:not(.sel) {
  opacity: 0.38;
}

.bar.sel .fill {
  box-shadow: 0 0 18px -4px var(--c);
}

.bar.missed.sel .fill {
  box-shadow: inset 0 0 0 1px var(--ink-2);
}

.guide {
  position: absolute;
  top: -4px;
  bottom: 0;
  width: 0;
  border-left: 1px solid var(--ink-2);
  pointer-events: none;
}

/* Courbe de cardio : trait d'encre cerclé du fond, lisible sur toutes les barres */
.hr {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;
  animation: fade-in 0.7s ease 0.5s backwards;
}

.hr path {
  fill: none;
  stroke-linejoin: round;
  stroke-linecap: round;
}

.hr-halo {
  stroke: var(--bg);
  stroke-width: 5;
  opacity: 0.55;
}

.hr-line {
  stroke: var(--ink);
  stroke-width: 1.75;
}

.hr-dot {
  position: absolute;
  width: 10px;
  height: 10px;
  margin: -5px 0 0 -5px;
  border-radius: 50%;
  background: var(--ink);
  box-shadow: 0 0 0 2px var(--bg);
  pointer-events: none;
}

@keyframes fade-in {
  from {
    opacity: 0;
  }
}

.axis {
  position: relative;
  height: 14px;
  margin-top: -2px;
}

.tick {
  position: absolute;
  top: 0;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--muted);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.tick:not(:first-child) {
  transform: translateX(-50%);
}

.readout {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 40px;
  margin: 2px 0 0;
  padding: 8px 12px;
  border-radius: var(--r-ctrl);
  background: var(--surface-2);
  font-size: 12.5px;
  line-height: 1.35;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}

.readout.on {
  color: var(--ink-2);
}

.readout strong {
  color: var(--ink);
  font-weight: 700;
}

.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;
  font-size: 12px;
  color: var(--muted);
}

.lg {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.lg--hint {
  margin-left: auto;
}

.sw {
  flex-shrink: 0;
  width: 10px;
  height: 10px;
  border-radius: calc(var(--r-ctrl) * 0.2);
  background: var(--c);
}

.sw.partial {
  background: repeating-linear-gradient(135deg, var(--c) 0 2px, transparent 2px 4px);
}

.sw.missed {
  background: repeating-linear-gradient(135deg, var(--line-strong) 0 1.5px, transparent 1.5px 4px);
  box-shadow: inset 0 0 0 1px var(--line-strong);
}

.sw--line {
  height: 2px;
  width: 14px;
  background: var(--ink);
}
</style>
