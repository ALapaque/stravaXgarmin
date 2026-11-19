<script setup lang="ts">
import { Sparkles, ChartLine, Check, Trophy, Heart, Mountain, Share2 } from 'lucide-vue-next'

const route = useRoute()
const { byId, isSynced, setStravaName, setStravaDescription, setGarminName } = useActivities()
const { accounts } = useAccounts()
const { recordsOf } = useRecords()
const { describe } = useDescription()
const { undo, entries } = useHistory()
const { show } = useToast()
const { notify } = useNotifications()
const settings = useSettings()

const a = computed(() => byId(String(route.params.id)))
if (!a.value) throw createError({ statusCode: 404, statusMessage: 'Activité introuvable' })

useHead({ title: () => `${a.value?.garminName} · stravaXgarmin` })

const synced = computed(() => (a.value ? isSynced(a.value) : false))
const records = computed(() => (a.value ? recordsOf(a.value) : []))
const paceSec = computed(() => (a.value ? Math.round(a.value.durationSec / a.value.distanceKm) : 0))
const description = computed(() => (a.value ? describe(a.value) : ''))
const descriptionAdded = computed(() => Boolean(a.value?.stravaDescription))

// Temps au km : barre plus haute = km plus rapide, le plus rapide mis en avant
const splits = computed(() => a.value?.splits ?? [])
const splitRange = computed(() => {
  const v = splits.value
  return { min: Math.min(...v), max: Math.max(...v) }
})
const splitH = (s: number) => {
  const { min, max } = splitRange.value
  return max === min ? 70 : Math.round(35 + ((max - s) / (max - min)) * 65)
}
// Vraie carte quand il y a un tracé GPS (ou en démo) ; sinon le dessin stylisé
const hasMap = computed(() => Boolean(a.value && (a.value.route || !a.value.stravaId)))
const typeColor = computed(() => (a.value ? RUN_TYPES[a.value.type].color : 'var(--accent-text)'))

function undoLast(message: string) {
  return {
    label: 'Annuler',
    run: async () => {
      const last = entries.value[0]
      if (last && (await undo(last.id))) show(message)
    },
  }
}

const canRenameGarmin = computed(() => Boolean(settings.value.garmin.rename && accounts.value.garmin.connected && a.value?.garminId))
const busy = ref(false)

async function copyToGarmin() {
  if (!a.value) return
  busy.value = true
  const ok = await setGarminName(a.value.id, a.value.stravaName, 'strava')
  busy.value = false
  if (ok) show('Nom copié vers Garmin', undoLast('Ancien nom remis sur Garmin'))
}

async function copyName() {
  if (!a.value) return
  busy.value = true
  const ok = await setStravaName(a.value.id, a.value.garminName, 'garmin')
  busy.value = false
  if (!ok) return
  show('Nom copié vers Strava', undoLast('Ancien nom remis sur Strava'))
  notify({ kind: 'titles', title: 'Nom copié vers Strava', body: a.value.garminName, to: `/activites/${a.value.id}` })
}

const { tab, direction } = useTab(['chiffres', 'nom'] as const, 'chiffres')
const tabs = computed(() => [
  { id: 'chiffres', label: 'Chiffres' },
  { id: 'nom', label: 'Nom et description', dot: !synced.value },
])

const sharing = ref(false)

/** Image au format story : tracé, titre et chiffres, dans le style du thème. */
async function shareImage() {
  const r = a.value
  if (!r) return
  sharing.value = true
  try {
    const rec = records.value[0]
    const blob = await renderRunImage({
      title: r.stravaName || r.garminName,
      type: RUN_TYPES[r.type].label,
      typeColor: RUN_TYPES[r.type].color,
      date: `${formatDay(r.startedAt)}${r.place ? ` · ${r.place}` : ''}`,
      stats: [
        { label: 'Distance', value: formatKm(r.distanceKm), unit: 'km' },
        { label: 'Durée', value: formatDuration(r.durationSec) },
        { label: 'Allure', value: formatPace(r.durationSec, r.distanceKm), unit: '/km' },
        r.avgHr ? { label: 'Cardio', value: String(r.avgHr), unit: 'bpm' } : { label: 'Dénivelé', value: String(r.elevationM), unit: 'm' },
      ],
      highlight: rec ? `Record sur ${rec.label} : ${formatDuration(rec.time)}` : undefined,
      points: r.route ? decodePolyline(r.route) : r.stravaId ? [] : demoRoute(r.id, r.type),
    })
    const how = await shareOrDownload(blob, `course-${r.startedAt.slice(0, 10)}.png`, r.stravaName || r.garminName)
    if (how === 'downloaded') show('Image de la course téléchargée')
  } catch (e) {
    if ((e as Error).name !== 'AbortError') show('Impossible de créer l’image')
  } finally {
    sharing.value = false
  }
}

async function addDescription() {
  if (!a.value || !description.value) return
  if (await setStravaDescription(a.value.id, description.value)) show('Description ajoutée sur Strava', undoLast('Description retirée de Strava'))
}
</script>

<template>
  <div class="stack detail">
    <template v-if="a">
      <BackLink to="/activites" label="Activités" />

      <section class="card hero" :style="{ '--c': typeColor }">
        <div class="map" :class="{ real: hasMap }">
          <ClientOnly>
            <RouteMap v-if="hasMap" :activity="a" />
            <template #fallback>
              <RouteTrace :activity="a" :width="1.6" :delay="200" />
            </template>
          </ClientOnly>
          <RouteTrace v-if="!hasMap" :activity="a" :width="1.6" :delay="200" />
        </div>
        <div class="hero-text">
          <p class="eyebrow type">{{ RUN_TYPES[a.type].label }}<span v-if="a.typeReason" class="why"> · {{ a.typeReason }}</span></p>
          <h1 class="h1">{{ a.garminName }}</h1>
          <p class="label">{{ formatDay(a.startedAt) }}<template v-if="a.place"> · {{ a.place }}</template> · {{ formatTime(a.startedAt) }}</p>
        </div>
      </section>

      <!-- Trois actions toujours sous la main -->
      <div class="actions">
        <NuxtLink :to="`/activites/${a.id}/titre`" class="card action">
          <Sparkles :size="20" aria-hidden="true" />
          <span>Titre</span>
        </NuxtLink>
        <NuxtLink :to="`/activites/${a.id}/analyse`" class="card action">
          <ChartLine :size="20" aria-hidden="true" />
          <span>Analyse</span>
        </NuxtLink>
        <button type="button" class="card action" :disabled="sharing" @click="shareImage">
          <Share2 :size="20" aria-hidden="true" />
          <span>{{ sharing ? 'Création…' : 'Partager' }}</span>
        </button>
      </div>

      <AppTabs v-model="tab" :tabs="tabs" label="Rubriques de la course" />

      <Transition :name="`tab-${direction}`" mode="out-in">
        <div v-if="tab === 'chiffres'" key="chiffres" class="panel">
          <div v-for="r in records" :key="r.key" class="block block--secondary record">
            <span class="trophy" aria-hidden="true"><Trophy :size="22" /></span>
            <span class="row__main">
              <span class="title">Record sur {{ r.label }} : {{ formatDuration(r.time) }}</span>
              <span v-if="r.previous" class="sub">{{ r.previous - r.time }} s de mieux que ton ancien record ({{ formatDuration(r.previous) }})</span>
            </span>
          </div>
          <dl class="kpis">
            <div class="card kpi kpi--wide">
              <dt class="eyebrow">Distance</dt>
              <dd class="num huge">{{ formatKm(a.distanceKm) }}<span class="unit">km</span></dd>
            </div>
            <div class="card kpi">
              <dt class="eyebrow">Durée</dt>
              <dd class="num">{{ formatDuration(a.durationSec) }}</dd>
            </div>
            <div class="card kpi" style="--k: var(--ok)">
              <dt class="eyebrow">Allure</dt>
              <dd class="num">{{ formatPace(a.durationSec, a.distanceKm) }}<span class="unit">/km</span></dd>
              <KpiPulse kind="pace" :value="paceSec" />
            </div>
            <div v-if="a.avgHr" class="card kpi" :style="{ '--k': 'var(--ko)', '--beat': `${(60 / a.avgHr).toFixed(3)}s` }">
              <dt class="eyebrow"><Heart class="heart" :size="11" fill="currentColor" aria-hidden="true" /> Cardio</dt>
              <dd class="num">{{ a.avgHr }}<span class="unit">bpm</span></dd>
              <KpiPulse kind="hr" :value="a.avgHr" />
            </div>
            <div v-if="a.elevationM" class="card kpi">
              <dt class="eyebrow"><Mountain :size="12" aria-hidden="true" /> Dénivelé</dt>
              <dd class="num">{{ a.elevationM }}<span class="unit">m</span></dd>
            </div>
          </dl>
          <section v-if="splits.length > 1" class="card card--pad splits" aria-labelledby="splits-title">
            <div class="section-head">
              <h2 id="splits-title" class="eyebrow">Allure au km</h2>
              <span class="label">meilleur km {{ formatPace(splitRange.min, 1) }}</span>
            </div>
            <ol class="split-bars" :style="{ '--n': splits.length }">
              <li v-for="(sp, k) in splits" :key="k" :style="{ '--k': k }" :aria-label="`Km ${k + 1} : ${formatPace(sp, 1)} par km`">
                <span class="sb" :class="{ best: sp === splitRange.min }" :style="{ height: `${splitH(sp)}%` }" />
                <span v-if="splits.length <= 14 || (k + 1) % 5 === 0" class="sk">{{ k + 1 }}</span>
              </li>
            </ol>
          </section>
        </div>

        <div v-else key="nom" class="panel">
          <section class="card list" aria-labelledby="names-title">
            <div class="row names-head">
              <h2 id="names-title" class="eyebrow">Nom de l’activité</h2>
              <StatusChip :ok="synced" :label="synced ? 'Identique' : 'Différent'" />
            </div>
            <div class="row">
              <BrandMark brand="garmin" />
              <span class="row__main">
                <span class="label">Garmin Connect</span>
                <span class="title">{{ a.garminName }}</span>
              </span>
            </div>
            <div class="row">
              <BrandMark brand="strava" />
              <span class="row__main">
                <span class="label">Strava</span>
                <span class="title">{{ a.stravaName }}</span>
              </span>
            </div>
          </section>
          <button v-if="!synced" type="button" class="btn btn--primary" :disabled="busy" @click="copyName">
            Copier le nom vers Strava
            <Check :size="20" aria-hidden="true" />
          </button>
          <button v-if="!synced && canRenameGarmin" type="button" class="btn btn--secondary" :disabled="busy" @click="copyToGarmin">
            Ou copier le nom Strava vers Garmin
          </button>
          <section v-if="settings.description.enabled && description" class="card card--pad desc" aria-labelledby="desc-title">
            <div class="desc-head">
              <h2 id="desc-title" class="eyebrow">Description Strava</h2>
              <StatusChip v-if="descriptionAdded" ok label="Ajoutée" />
            </div>
            <p class="desc-text">{{ a.stravaDescription || description }}</p>
            <button v-if="!descriptionAdded" type="button" class="btn btn--secondary btn--sm" @click="addDescription">
              Ajouter sur Strava
            </button>
          </section>
        </div>
      </Transition>
    </template>
  </div>
</template>

<style scoped>
.detail {
  gap: 14px;
}

/* ── Tracé en grand ── */
.hero {
  overflow: hidden;
  border-radius: calc(var(--r-card) + 6px);
}

.hero::after {
  content: '';
  position: absolute;
  z-index: 1;
  inset: 0;
  border-radius: inherit;
  background:
    radial-gradient(80% 60% at 50% 35%, color-mix(in srgb, var(--c) 26%, transparent), transparent 70%),
    linear-gradient(180deg, transparent 45%, color-mix(in srgb, var(--bg) 85%, transparent));
  pointer-events: none;
}

/* Quadrillage discret façon carte */
.map {
  position: relative;
  z-index: 1;
  aspect-ratio: 1 / 0.82;
  padding: 26px 30px 70px;
  background-image:
    linear-gradient(var(--line) 1px, transparent 1px),
    linear-gradient(90deg, var(--line) 1px, transparent 1px);
  background-size: 28px 28px;
  background-position: center;
  -webkit-mask: radial-gradient(90% 80% at 50% 40%, #000 55%, transparent);
  mask: radial-gradient(90% 80% at 50% 40%, #000 55%, transparent);
}

.map.real {
  padding: 0;
  aspect-ratio: 1 / 0.95;
  background: none;
  -webkit-mask: none;
  mask: none;
}

/* Le texte du bas laisse passer les gestes vers la carte */
.hero-text {
  pointer-events: none;
}

.hero-text {
  position: absolute;
  z-index: 2;
  left: 20px;
  right: 20px;
  bottom: 18px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.type {
  color: var(--c);
}

.why {
  color: var(--muted);
  letter-spacing: 0.08em;
}

.hero-text .h1 {
  font-size: 30px;
  text-shadow: var(--title-shadow, 0 2px 20px rgba(0, 0, 0, 0.5));
}

.record {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
}

.record > * {
  position: relative;
  z-index: 1;
}

.trophy {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  border-radius: var(--r-ctrl);
  background: color-mix(in srgb, currentColor 18%, transparent);
  animation: pop 0.7s var(--ease-spring) 0.35s backwards;
}

.record .sub {
  font-size: 15px;
  opacity: 0.85;
}

/* ── Actions ── */
.actions {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.action {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 12px 6px;
  color: var(--ink);
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.15s var(--ease-spring);
}

.action:active {
  transform: scale(0.95);
}

.action svg {
  color: var(--accent-text);
}

.action:disabled {
  opacity: 0.6;
}

/* ── Chiffres ── */
.kpis {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin: 0;
}

.kpi {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  min-width: 0;
  color: var(--k, var(--ink));
}

.kpi--wide {
  grid-column: 1 / -1;
  flex-direction: row;
  align-items: flex-end;
  justify-content: space-between;
}

.kpi dt {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--k, var(--muted));
}

.kpi dd {
  display: flex;
  align-items: baseline;
  gap: 4px;
  margin: 0;
  font-size: 28px;
  color: var(--ink);
}

.kpi dd.huge {
  font-size: 54px;
  letter-spacing: -0.05em;
}

.unit {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0;
  color: var(--muted);
}

.kpi :deep(.pulse) {
  margin-top: auto;
}

/* Le cœur bat au rythme réel de la fréquence cardiaque moyenne */
.heart {
  animation: beat var(--beat) ease-out infinite;
}

@keyframes beat {
  0%,
  100% {
    transform: scale(1);
  }
  15% {
    transform: scale(1.35);
  }
  30% {
    transform: scale(0.95);
  }
  45% {
    transform: scale(1.15);
  }
}

/* ── Kilomètres ── */
.splits {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.split-bars {
  display: grid;
  grid-template-columns: repeat(var(--n), 1fr);
  align-items: end;
  gap: 4px;
  height: 110px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.split-bars li {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  height: 100%;
}

.sb {
  width: 100%;
  max-width: 22px;
  border-radius: 6px 6px 3px 3px;
  background: linear-gradient(180deg, var(--type-long), color-mix(in srgb, var(--type-long) 25%, transparent));
  transform-origin: bottom;
  animation: grow 0.7s var(--ease-spring) backwards;
  animation-delay: calc(200ms + var(--k) * 40ms);
}

.sb.best {
  background: linear-gradient(180deg, var(--accent-text), color-mix(in srgb, var(--accent-text) 25%, transparent));
  box-shadow: 0 0 16px -2px var(--accent-text);
}

.sk {
  font-size: 10px;
  font-weight: 700;
  color: var(--muted);
}

.names-head {
  justify-content: space-between;
  min-height: 52px;
}

.desc {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.desc-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.desc-text {
  margin: 0;
  white-space: pre-line;
  font-family: var(--font-mono);
  font-size: 13px;
  line-height: 1.7;
  color: var(--ink-2);
}

.desc .btn {
  align-self: flex-start;
}

@media (prefers-reduced-motion: reduce) {
  .heart {
    animation: none;
  }
}
</style>
