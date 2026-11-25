<script setup lang="ts">
/*
 * Réglages · Coureur : tes cinq zones cardio avec leurs plages en bpm (celles de ta montre Garmin, de ton
 * compte Strava, ou calculées sur ta FC max : useZones, shared/utils/zones.ts), ta FC max (estimée d'après
 * tes courses, ou saisie entre 120 et 230), ton objectif course et le seuil d'usure des chaussures.
 * La page d'une course y renvoie par son lien « Modifier » sous les zones.
 */
import { Footprints, HeartPulse, RotateCcw } from 'lucide-vue-next'
import { estimateHrMax, hrZones, zoneRange, zoneSourceLine, type ZoneSource } from '#shared/utils/zones'

useHead({ title: 'Coureur · stravaXgarmin' })

const settings = useSettings()
const { activities } = useActivities()
const { show } = useToast()

const HR_MIN = 120
const HR_MAX = 230

const estimated = computed(() => estimateHrMax(activities.value))
const maxHr = computed(() => settings.value.hrMax || estimated.value)
const fromUser = computed(() => Boolean(settings.value.hrMax))

/* Champ : on n'écrit le réglage qu'avec une valeur plausible */
// (un champ numérique rend un nombre, ou une chaîne vide)
const draft = ref<string | number>('')
watch(maxHr, (v) => (draft.value = v ? String(v) : ''), { immediate: true })
const error = ref('')
function commit() {
  const raw = String(draft.value ?? '').trim()
  if (!raw) {
    error.value = ''
    if (settings.value.hrMax) reset()
    return
  }
  const n = Math.round(Number(raw.replace(',', '.')))
  if (!Number.isFinite(n) || n < HR_MIN || n > HR_MAX) {
    error.value = `Entre une valeur entre ${HR_MIN} et ${HR_MAX} battements par minute.`
    return
  }
  error.value = ''
  if (n === settings.value.hrMax) return
  settings.value.hrMax = n
  show('FC max enregistrée')
}
function reset() {
  settings.value.hrMax = null
  error.value = ''
  draft.value = estimated.value ? String(estimated.value) : ''
  show(estimated.value ? 'Retour à la FC max estimée' : 'FC max effacée')
}

const ZONE_USE = [
  'Échauffement, retour au calme, récupération',
  'Footings et sortie longue : la base de ton endurance',
  'Allure soutenue mais tenable longtemps',
  'Fractionné long, allure 10 km à semi',
  'Efforts courts et très durs, VMA',
]
const BAR_MIX = [34, 50, 66, 82, 100]

/* ───── Zones : celles de la montre, de Strava, ou calculées sur la FC max ───── */

const zoneState = useZones()
const restored = useRestored()
const { active: demo } = useDemo()
const SOURCES: { id: ZoneSource; label: string }[] = [
  { id: 'garmin', label: 'Garmin' },
  { id: 'strava', label: 'Strava' },
  { id: 'fcmax', label: 'FC max' },
]
const pick = computed(() => zoneState.pick())
const zones = computed(() => (pick.value.set ? [...hrZones(pick.value.set, pick.value.from)].reverse() : []))
const reading = ref(false)
async function readZones() {
  if (reading.value) return
  reading.value = true
  try {
    await zoneState.loadLatest()
  } finally {
    reading.value = false
  }
}
/*
 * Lecture une fois l'état gardé rechargé et les courses connues (navigateur seulement) ; à nouveau si tu
 * changes de source. Un seul essai par visite et par source : un échec ne relance pas la lecture en boucle.
 */
const hasRuns = computed(() => activities.value.some((a) => a.stravaId && a.avgHr > 0))
// Les zones de la montre se lisent sans course ; celles de Strava viennent avec une course
let asked: '' | 'norun' | 'run' = ''
watch(
  () => [restored.value, zoneState.source.value, hasRuns.value] as const,
  ([ready, source, runs], old) => {
    if (source !== old?.[1]) asked = ''
    const level = runs ? 'run' : 'norun'
    if (!ready || source === 'fcmax' || asked === 'run' || asked === level) return
    if (!runs && source !== 'garmin') return
    asked = level
    readZones()
  },
  { immediate: true },
)
const zonesLine = computed(() => {
  // Avant que l'état gardé soit rechargé, on ne sait pas encore : pas de phrase qui changerait aussitôt
  if (!restored.value && !demo.value) return '\u00a0'
  const known = zoneState.known.value
  return zoneSourceLine(pick.value, { reading: reading.value, method: known.garmin?.method, custom: known.strava?.custom })
})
/** La FC max ne sert pas tant que les zones viennent d'ailleurs */
const hrUnused = computed(() => (pick.value.from === 'garmin' ? 'ta montre' : pick.value.from === 'strava' ? 'Strava' : ''))
const sourceLine = computed(() => {
  if (fromUser.value) return estimated.value ? `Saisie par toi · estimée d’après tes courses : ${estimated.value} bpm` : 'Saisie par toi'
  if (estimated.value) return 'Estimée d’après tes courses : la plus haute fréquence cardiaque vue'
  return 'Il faut au moins trois courses avec cardio pour l’estimer : sinon, saisis-la.'
})
</script>

<template>
  <div class="stack stack--wide">
    <BackLink to="/reglages" label="Réglages" />
    <div class="title-block">
      <h1 class="h1">Coureur</h1>
      <p class="lead">Ton cœur, ton objectif et tes chaussures, pour lire tes courses au plus juste.</p>
    </div>

    <div class="cols">
      <div class="col">
        <h2 id="zones-title" class="eyebrow group">Tes cinq zones</h2>
        <section class="card zones-card" aria-labelledby="zones-title">
          <div class="zones-src">
            <div class="segmented" role="group" aria-label="D’où viennent tes zones">
              <button v-for="o in SOURCES" :key="o.id" type="button" :aria-pressed="zoneState.source.value === o.id" @click="settings.zoneSource = o.id">{{ o.label }}</button>
            </div>
            <p class="hint" aria-live="polite">{{ zonesLine }}</p>
            <NuxtLink v-if="pick.wanted === 'garmin' && pick.why === 'unlinked'" to="/connexion/garmin" class="link">Connecter Garmin</NuxtLink>
          </div>
          <ol v-if="zones.length" class="zones">
            <li v-for="z in zones" :key="z.z" class="zone" :style="{ '--mix': `${BAR_MIX[z.z - 1]}%`, '--w': `${40 + z.z * 12}%`, '--k': 5 - z.z }">
              <span class="z-k num" aria-hidden="true">Z{{ z.z }}</span>
              <span class="z-main">
                <span class="z-head">
                  <span class="z-name">Zone {{ z.z }} · {{ z.label }}</span>
                  <span class="z-range num">{{ zoneRange(z) }} bpm</span>
                </span>
                <span class="z-bar" aria-hidden="true"><span /></span>
                <span class="z-use">{{ ZONE_USE[z.z - 1] }}</span>
              </span>
            </li>
          </ol>
          <p v-else class="lead empty">Saisis ta FC max, ou cours trois fois avec ta ceinture ou ta montre : tes zones apparaîtront ici.</p>
        </section>

        <h2 id="hr-title" class="eyebrow group">Fréquence cardiaque maximale</h2>
        <section class="card hr" aria-labelledby="hr-title">
          <div class="hr-top">
            <span class="tile" style="--tile: var(--ko)" aria-hidden="true"><HeartPulse :size="22" /></span>
            <div class="hr-main">
              <label class="hr-field">
                <span class="sr-only">FC max en battements par minute</span>
                <input
                  v-model="draft"
                  class="num hr-input"
                  type="number"
                  inputmode="numeric"
                  :min="HR_MIN"
                  :max="HR_MAX"
                  step="1"
                  placeholder="–"
                  :aria-invalid="Boolean(error) || undefined"
                  aria-describedby="hr-source hr-error"
                  @change="commit"
                  @keydown.enter.prevent="commit"
                >
                <span class="unit">bpm</span>
              </label>
              <span v-if="fromUser" class="chip chip--ok">saisie</span>
              <span v-else-if="estimated" class="chip">estimée</span>
            </div>
          </div>
          <p id="hr-source" class="hint">{{ sourceLine }}</p>
          <p v-if="hrUnused" class="hint">Elle ne sert pas tant que tes zones viennent de {{ hrUnused }}.</p>
          <p v-if="error" id="hr-error" class="err" role="alert">{{ error }}</p>
          <button v-if="fromUser" type="button" class="btn btn--sm btn--secondary reset" @click="reset">
            <RotateCcw :size="16" aria-hidden="true" /> Revenir à l’estimation
          </button>
        </section>
      </div>

      <div class="col">
        <h2 class="eyebrow group">Objectif</h2>
        <GoalCard />

        <h2 id="shoes-title" class="eyebrow group">Chaussures</h2>
        <section class="card card--pad shoes" aria-labelledby="shoes-title">
          <div class="shoe-top">
            <span class="tile" style="--tile: var(--accent-text)" aria-hidden="true"><Footprints :size="22" /></span>
            <span class="row__main">
              <span class="title">Seuil d’usure</span>
              <span class="hint">Au-delà, une paire est signalée « à remplacer »</span>
            </span>
            <span class="num km">{{ settings.shoeLimitKm }}<span class="unit">km</span></span>
          </div>
          <input v-model.number="settings.shoeLimitKm" class="range" type="range" min="400" max="1000" step="50" aria-label="Seuil d’usure en kilomètres">
          <div class="ticks fine" aria-hidden="true"><span>400 km</span><span>700 km</span><span>1 000 km</span></div>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.title-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.title-block .lead {
  margin: 0;
}

.group {
  margin: 4px 0 0;
  color: var(--accent-text);
}

.hint {
  margin: 0;
  font-size: 14px;
  color: var(--muted);
}

/* ── FC max ── */
.hr {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 18px;
}

.hr-top {
  display: flex;
  align-items: center;
  gap: 14px;
}

/* Le nombre n'est jamais rogné : écran étroit et police large, la pastille passe dessous, alignée sur lui */
.hr-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 14px;
}

.hr-field {
  flex: 1 0 auto;
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.hr-input {
  flex: none;
  width: 3.6ch;
  padding: 0 0 2px;
  border: 0;
  border-bottom: 2px solid var(--line-strong);
  border-radius: 0;
  background: transparent;
  color: var(--ink);
  font-size: 48px;
  line-height: 1.05;
  transition: border-color 0.2s ease;
  -moz-appearance: textfield;
  appearance: textfield;
}

.hr-input::-webkit-outer-spin-button,
.hr-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.hr-input:focus {
  outline: none;
  border-bottom-color: var(--primary-solid);
}

.hr-input[aria-invalid='true'] {
  border-bottom-color: var(--ko);
}

.unit {
  font-family: var(--font-mono);
  font-size: 15px;
  font-weight: 700;
  color: var(--muted);
}

.err {
  margin: 0;
  color: var(--ko);
  font-weight: 600;
  font-size: 14px;
}

.reset {
  align-self: flex-start;
  width: auto;
}

/* ── Zones : de la plus dure (en haut) à la plus douce, une seule teinte de plus en plus franche ── */
.zones-card {
  display: flex;
  flex-direction: column;
  padding: 0 0 6px;
}

.zones-src {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 18px 18px 12px;
  border-bottom: 1px solid var(--line);
}

.zones {
  margin: 0;
  padding: 0;
  list-style: none;
}

.zone {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 18px;
  animation: rise 0.45s var(--ease-out) backwards;
  animation-delay: calc(80ms + var(--k) * 50ms);
}

.zone + .zone {
  border-top: 1px solid var(--line);
}

.z-k {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: var(--r-ctrl);
  font-size: 14px;
  color: var(--ink);
  background: color-mix(in srgb, var(--ko) var(--mix), transparent);
}

.z-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.z-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.z-name {
  font-weight: 700;
  font-size: 15px;
}

.z-range {
  flex-shrink: 0;
  font-size: 15px;
}

.z-bar {
  height: 6px;
  border-radius: var(--r-pill);
  background: var(--line);
  overflow: hidden;
}

.z-bar span {
  display: block;
  width: var(--w);
  height: 100%;
  border-radius: inherit;
  background: color-mix(in srgb, var(--ko) var(--mix), transparent);
  transform-origin: left;
  animation: grow-x 0.7s var(--ease-spring) backwards;
  animation-delay: calc(150ms + var(--k) * 60ms);
}

@keyframes grow-x {
  from {
    transform: scaleX(0);
  }
}

.z-use {
  font-size: 13px;
  color: var(--muted);
}

.empty {
  margin: 0;
  padding: 14px 18px;
  font-size: 15px;
}

/* ── Chaussures ── */
.shoes {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.shoe-top {
  display: flex;
  align-items: center;
  gap: 12px;
}

.shoe-top .title {
  white-space: normal;
}

.km {
  display: flex;
  align-items: baseline;
  gap: 4px;
  flex-shrink: 0;
  font-size: 28px;
}

.km .unit {
  font-size: 13px;
}

.range {
  width: 100%;
  height: 32px;
  margin: 0;
  accent-color: var(--primary-solid);
}

.ticks {
  display: flex;
  justify-content: space-between;
  margin-top: -6px;
}
</style>
