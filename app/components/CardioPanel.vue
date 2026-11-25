<script setup lang="ts">
/*
 * Cardio d'une course : la courbe de fréquence cardiaque en aire, posée sur les bandes de zones,
 * puis le temps passé dans chaque zone (cinq barres avec libellé, durée et pourcentage).
 * Zones : une seule teinte (--ko), de plus en plus franche de la zone 1 à la zone 5, et toujours
 * nommées (jamais la couleur seule). États : chargement, erreur, pas de cardio, pas de zones.
 * Les zones sont celles de la montre du coureur, sinon de son compte Strava (le temps par zone est alors
 * celui compté à la source), sinon calculées sur sa FC max : le choix est fait par useZones().pick.
 * Une course courue avant un changement de zones est relue avec celles d'aujourd'hui ; un bouton
 * ramène à celles du jour (événement « view »).
 * Géométrie : shared/utils/runchart.ts ; zones : shared/utils/zones.ts.
 */
import { HeartCrack, RefreshCw } from 'lucide-vue-next'
import type { RunStream } from '#shared/utils/streams'
import type { ZonePick } from '#shared/utils/zones'

const props = withDefaults(
  defineProps<{
    stream: RunStream | null
    state: 'loading' | 'error' | 'none' | 'ready'
    /** Zones à afficher et leur origine (montre, compte Strava, FC max saisie, FC max la plus haute vue) */
    zones: ZonePick
    /** Lien « Modifier » vers le réglage des zones (absent : pas de lien) */
    settingsTo?: string | null
    avgHr?: number | null
    peakHr?: number | null
    height?: number
  }>(),
  { settingsTo: null, avgHr: null, peakHr: null, height: 150 },
)
defineEmits<{ retry: []; view: [view: 'current' | 'day'] }>()

/** Bandes de zones (fond) et barres : de plus en plus franches */
const BAND_MIX = [6, 10, 15, 21, 29]
const BAR_MIX = [34, 50, 66, 82, 100]

const W = 1000
const H = 100
const total = computed(() => {
  const t = props.stream?.t ?? []
  return t.length ? t[t.length - 1]! : 0
})
const bounds = computed(() => hrBounds(props.stream?.hr))
const scale = computed(() => (bounds.value && total.value ? { total: total.value, lo: bounds.value.lo, hi: bounds.value.hi, w: W, h: H } : null))
const paths = computed(() => (scale.value ? seriesPath(props.stream?.t, props.stream?.hr, scale.value) : { line: '', area: '' }))
const ticks = computed(() => timeTicks(total.value))
const floors = computed(() => props.zones.set?.floors ?? null)
const rows = computed(() => (props.zones.set ? hrZones(props.zones.set, props.zones.from) : []))
/** Bas de la zone 1 de la montre : en dessous, Garmin ne compte le temps dans aucune zone, et l'appli fait pareil */
const lowBound = computed(() => (props.zones.from === 'garmin' ? (rows.value[0]?.from || null) : null))
const yOf = (v: number) => {
  const s = scale.value!
  return ((s.hi - Math.min(Math.max(v, s.lo), s.hi)) / (s.hi - s.lo)) * 100
}
/** Bandes visibles dans l'échelle, avec leur position (en % de la hauteur) */
const bands = computed(() => {
  const s = scale.value
  const f = floors.value
  if (!s || !f) return []
  // Une bande va du seuil de sa zone au seuil de la suivante ; la zone 1 part du bas (ou de son propre bas, pour la montre), la zone 5 va jusqu'en haut
  return rows.value
    .map((z, i) => {
      const top = yOf(i === 4 ? s.hi : f[i]!)
      const bottom = yOf(i === 0 ? (lowBound.value ?? s.lo) : f[i - 1]!)
      return { z: z.z, top, h: bottom - top }
    })
    .filter((b) => b.h > 0.5)
})

// Temps par zone : celui compté par la montre ou par Strava quand il vient avec les zones, sinon compté sur la courbe
const zoneSec = computed(() => props.zones.sec ?? timeInZones(props.stream, floors.value, lowBound.value))
const shares = computed(() => zoneShares(zoneSec.value, lowBound.value ? total.value : null))
/** Temps passé sous la zone 1 de la montre (dans aucune zone) ; 0 s'il est négligeable */
const below = computed(() => {
  if (!lowBound.value || !zoneSec.value) return 0
  const rest = Math.round(total.value - zoneSec.value.reduce((a, b) => a + b, 0))
  return rest >= 30 ? rest : 0
})
const maxShare = computed(() => Math.max(...shares.value.map((s) => s.sec), 1))

/* Survol : instant, cardio et zone sous le doigt ou la souris */
const at = ref<number | null>(null)
const plot = ref<HTMLElement>()
function onMove(e: PointerEvent) {
  const r = plot.value?.getBoundingClientRect()
  if (!r || !total.value) return
  at.value = Math.min(Math.max((e.clientX - r.left) / r.width, 0), 1) * total.value
}
const hover = computed(() => {
  if (at.value === null) return null
  const v = valueAt(props.stream?.t, props.stream?.hr, at.value)
  if (v === null) return null
  // 0 : sous la zone 1 de la montre
  const z = !floors.value ? null : lowBound.value && v < lowBound.value ? 0 : zoneOf(v, floors.value)
  return { x: at.value / total.value, y: yOf(v), v, z }
})
const label = computed(() => {
  const z = shares.value.filter((s) => s.sec > 0).map((s) => `zone ${s.z} : ${s.pct} %`)
  return `Fréquence cardiaque pendant la course${props.avgHr ? `, ${props.avgHr} bpm en moyenne` : ''}${z.length ? `. Temps par zone : ${z.join(', ')}` : ''}.`
})
</script>

<template>
  <section class="card card--pad cardio" aria-labelledby="cardio-title">
    <div class="section-head">
      <h2 id="cardio-title" class="eyebrow">Cardio</h2>
      <span v-if="state === 'ready' && (avgHr || peakHr)" class="label">
        <template v-if="avgHr">moy. {{ avgHr }}</template><template v-if="avgHr && peakHr"> · </template><template v-if="peakHr">max {{ peakHr }}</template> bpm
      </span>
    </div>

    <div v-if="state === 'loading'" class="wait" role="status">
      <span class="shimmer" :style="{ height: `${height}px` }" aria-hidden="true" />
      <p class="fine">Chargement de ta courbe de cardio…</p>
    </div>

    <div v-else-if="state === 'error'" class="empty" role="alert">
      <p class="lead">Impossible de lire ta courbe de cardio pour l’instant.</p>
      <button type="button" class="btn btn--secondary btn--sm" @click="$emit('retry')"><RefreshCw :size="16" aria-hidden="true" /> Réessayer</button>
    </div>

    <div v-else-if="state === 'none' || !paths.line" class="empty">
      <span class="tile" style="--tile: var(--muted)" aria-hidden="true"><HeartCrack :size="22" /></span>
      <div>
        <template v-if="avgHr">
          <p class="title">Pas de courbe de cardio pour cette course.</p>
          <p class="fine">Seule ta moyenne est connue : {{ avgHr }} bpm.</p>
        </template>
        <template v-else>
          <p class="title">Pas de cardio sur cette course.</p>
          <p class="fine">Ta montre n’a pas enregistré ta fréquence cardiaque, ou Strava ne l’a pas reçue.</p>
        </template>
      </div>
    </div>

    <template v-else>
      <figure class="chart" :aria-label="label" role="img">
        <div ref="plot" class="plot" :style="{ height: `${height}px` }" @pointermove="onMove" @pointerleave="at = null">
          <span
            v-for="b in bands"
            :key="b.z"
            class="band"
            :style="{ top: `${b.top}%`, height: `${b.h}%`, '--mix': `${BAND_MIX[b.z - 1]}%` }"
          ><span v-if="b.h > 9" class="band-k">Z{{ b.z }}</span></span>
          <span v-for="t in ticks" :key="t.t" class="gridline" :style="{ left: `${t.x * 100}%` }" />
          <svg class="curve" :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="none" aria-hidden="true">
            <path class="area" :d="paths.area" />
            <path class="line" :d="paths.line" vector-effect="non-scaling-stroke" />
          </svg>
          <template v-if="hover">
            <span class="guide" :style="{ left: `${hover.x * 100}%` }" />
            <span class="dot" :style="{ left: `${hover.x * 100}%`, top: `${hover.y}%` }" />
          </template>
        </div>
        <div class="axis" aria-hidden="true">
          <span v-for="t in ticks" :key="t.t" class="tick" :style="{ left: `${t.x * 100}%` }">{{ t.label }}</span>
        </div>
        <p class="readout" :class="{ on: hover }" aria-hidden="true">
          <template v-if="hover">{{ clock(at ?? 0) }} ·{{ hover.v }} bpm<template v-if="hover.z"> · zone {{ hover.z }}</template><template v-else-if="hover.z === 0"> · sous la zone 1</template></template>
          <template v-else>Survole ou touche la courbe pour lire ton cardio.</template>
        </p>
      </figure>

      <ol v-if="rows.length && shares.length" class="zones" aria-label="Temps par zone">
        <li v-for="s in [...shares].reverse()" :key="s.z" class="zone" :style="{ '--mix': `${BAR_MIX[s.z - 1]}%`, '--w': `${(s.sec / maxShare) * 100}%`, '--k': 5 - s.z }">
          <span class="z-head">
            <span class="z-k">Z{{ s.z }}</span>
            <span class="z-name">{{ rows[s.z - 1]?.label }}</span>
            <span v-if="rows[s.z - 1]" class="z-range">{{ zoneRange(rows[s.z - 1]!) }}</span>
            <span class="z-val"><span class="num">{{ clock(s.sec) }}</span><span class="z-pct">{{ s.pct }} %</span></span>
          </span>
          <span class="z-track" aria-hidden="true"><span class="z-bar" :class="{ empty: !s.sec }" /></span>
        </li>
      </ol>

      <p v-if="below" class="fine below">{{ clock(below) }} sous ta zone 1 : comme ta montre, l’appli ne les compte dans aucune zone.</p>

      <p class="fine maxhr">
        {{ zoneNote(zones) }}
        <button v-if="zones.changed" type="button" class="link" @click="$emit('view', zones.view === 'day' ? 'current' : 'day')">
          {{ zones.view === 'day' ? 'Voir avec mes zones actuelles' : 'Voir les zones du jour' }}
        </button>
        <NuxtLink v-if="settingsTo" :to="settingsTo" class="link">Modifier</NuxtLink>
      </p>
    </template>
  </section>
</template>

<style scoped>
.cardio {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.cardio .section-head {
  margin-top: 0;
}

.wait {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.shimmer {
  display: block;
  border-radius: var(--r-ctrl);
  background: linear-gradient(100deg, var(--surface-2) 30%, color-mix(in srgb, var(--ink) 8%, var(--surface-2)) 50%, var(--surface-2) 70%);
  background-size: 300% 100%;
  animation: shimmer 1.4s ease-in-out infinite;
}

@keyframes shimmer {
  from {
    background-position: 100% 0;
  }
  to {
    background-position: 0 0;
  }
}

.empty {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}

.empty .title {
  margin: 0 0 2px;
}

.chart {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
}

.plot {
  position: relative;
  border-bottom: 1px solid var(--line-strong);
  cursor: crosshair;
  touch-action: pan-y;
}

.band {
  position: absolute;
  left: 0;
  right: 0;
  background: color-mix(in srgb, var(--ko) var(--mix), transparent);
  border-top: 1px solid color-mix(in srgb, var(--ko) calc(var(--mix) + 6%), transparent);
}

.band-k {
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  color: var(--muted);
}

.gridline {
  position: absolute;
  top: 0;
  bottom: 0;
  border-left: 1px dashed var(--line);
}

.curve {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.area {
  fill: color-mix(in srgb, var(--ko) 22%, transparent);
  transform-origin: bottom;
  animation: grow 0.8s var(--ease-out) 0.2s backwards;
}

.line {
  fill: none;
  stroke: var(--ko);
  stroke-width: 2;
  stroke-linejoin: round;
}

.guide {
  position: absolute;
  top: 0;
  bottom: 0;
  border-left: 1px solid var(--ink-2);
  pointer-events: none;
}

.dot {
  position: absolute;
  width: 10px;
  height: 10px;
  margin: -5px 0 0 -5px;
  border-radius: 50%;
  background: var(--ko);
  box-shadow: 0 0 0 2px var(--bg);
  pointer-events: none;
}

.axis {
  position: relative;
  height: 14px;
}

.tick {
  position: absolute;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--muted);
  white-space: nowrap;
}

.tick:not(:first-child) {
  transform: translateX(-50%);
}

.readout {
  min-height: 20px;
  margin: 0;
  font-size: 13px;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}

.readout.on {
  color: var(--ink);
  font-weight: 600;
}

/* ── Temps par zone ── */
.zones {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.zone {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.z-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: 14px;
}

.z-k {
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 700;
  color: var(--ink);
}

.z-name {
  font-weight: 600;
  color: var(--ink-2);
}

.z-range {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--muted);
}

.z-val {
  display: inline-flex;
  align-items: baseline;
  gap: 8px;
  margin-left: auto;
}

.z-val .num {
  font-size: 16px;
}

.z-pct {
  min-width: 4ch;
  text-align: right;
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--muted);
}

.z-track {
  display: block;
  height: 8px;
  border-radius: var(--r-pill);
  background: var(--surface-2);
  overflow: hidden;
}

.z-bar {
  display: block;
  width: var(--w);
  height: 100%;
  border-radius: inherit;
  background: color-mix(in srgb, var(--ko) var(--mix), transparent);
  transform-origin: left;
  animation: grow-x 0.7s var(--ease-out) backwards;
  animation-delay: calc(200ms + var(--k) * 60ms);
}

.z-bar.empty {
  width: 0;
}

@keyframes grow-x {
  from {
    transform: scaleX(0);
  }
}

.below {
  margin: 0;
}

.maxhr {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0 8px;
}

.maxhr .link {
  font-size: 13px;
  padding: 12px 0;
}
</style>
