<script setup lang="ts">
/*
 * Page d'une course, en un seul défilement, pensée pour le tapis :
 * en-tête visuel (la carte dehors ; sinon la séance réalisée tour par tour, cardio par-dessus),
 * chiffres, débrief, prévu ↔ réalisé, cardio par zones, kilomètres ou tours, records, chaussures.
 * Ordinateur (à partir de 860 px) : deux colonnes, l'en-tête visuel et le débrief à gauche.
 */
import { ArrowRight, ClipboardCheck, Footprints, Heart, Mountain, Share2, Trophy } from 'lucide-vue-next'

const { recordsOf } = useRecords()
const { show } = useToast()
const plan = usePlan()
const convention = useConvention()
const { get: getDebrief, toDebrief } = useDebriefs()
const streams = useStreams()
const zones = useZones()

// Course ouverte par son adresse : jamais de 404 avant d'avoir rechargé l'état gardé et synchronisé
const { run: a, state } = useRunPage()

useHead({ title: () => `${a.value ? displayTitle(a.value).title : 'Course'} · stravaXgarmin` })

const records = computed(() => (a.value ? recordsOf(a.value) : []))
const paceSec = computed(() => (a.value ? Math.round(a.value.durationSec / a.value.distanceKm) : 0))
const typeColor = computed(() => (a.value ? RUN_TYPES[a.value.type].color : 'var(--accent-text)'))

/* ───── En-tête ───── */

// Vraie carte quand il y a un tracé GPS (ou en démo) ; jamais sur tapis
const hasMap = computed(() => Boolean(a.value && !a.value.indoor && (a.value.route || !a.value.stravaId)))
const laps = computed(() => a.value?.laps ?? [])
const title = computed(() => (a.value ? displayTitle(a.value) : { title: '', tags: [] }))
const failed = computed(() => title.value.tags.includes(convention.failTag.value))
const sources = computed(() => title.value.tags.filter((t) => t !== convention.failTag.value))
const dateLine = computed(() => (a.value ? [formatDay(a.value.startedAt), placeLabel(a.value), formatTime(a.value.startedAt)].filter(Boolean).join(' · ') : ''))
const stravaUrl = computed(() => (a.value?.stravaId ? `https://www.strava.com/activities/${a.value.stravaId}` : null))

/* ───── Séance reliée ───── */

const session = computed(() => (a.value ? plan.sessionFor(a.value) : null))
const result = computed(() => (a.value ? plan.resultFor(a.value) : null))
const sessionSteps = computed(() => {
  const s = session.value
  if (!s) return []
  return s.steps?.length ? s.steps : (parseWorkoutTitle(s.title)?.steps ?? [])
})
const debrief = computed(() => (a.value ? getDebrief(a.value.id) : null))
/** L'issue choisie dans le débrief passe avant celle proposée d'après les tours */
const outcome = computed(() => (debrief.value?.status === 'done' && debrief.value.outcome) || result.value?.outcome || null)
const debriefDone = computed(() => debrief.value?.status === 'done')
const debriefTodo = computed(() => Boolean(a.value) && toDebrief.value.some((x) => x.id === a.value!.id))

/* ───── Cardio : courbes chargées à l'ouverture ───── */

const stream = computed(() => (a.value ? streams.get(a.value.id) : null))
const hasHr = computed(() => Boolean(a.value && (a.value.avgHr > 0 || laps.value.some((l) => l.hr))))
const loadFailed = ref(false)
const restored = useRestored()
async function loadStream() {
  const r = a.value
  if (!r || !hasHr.value || stream.value || streams.isLoading(r.id)) return
  loadFailed.value = false
  const got = await streams.load(r)
  if (!got) loadFailed.value = true
}
/*
 * Chargement une fois l'état gardé rechargé (il remplace les courbes en mémoire) ; à nouveau si la
 * course change ou si ses courbes disparaissent, jamais en boucle après un échec (« Réessayer »).
 */
watch(
  () => [a.value?.id, restored.value, Boolean(stream.value)] as const,
  ([id, ready, have], old) => {
    if (id !== old?.[0]) loadFailed.value = false
    if (id && ready && !have && !loadFailed.value) loadStream()
  },
  { immediate: true },
)

/*
 * Zones : celles de la montre, sinon celles du compte Strava, lues avec la course (une fois l'état gardé
 * rechargé, comme les courbes). Tant que ces lectures ne sont pas finies, le bloc cardio attend : pas de
 * zones qui changent sous les yeux. Un seul essai par course et par visite : après un échec, les zones
 * de secours s'affichent, sans redemander à chaque fois que la liste des courses bouge (synchro, détails).
 */
let zonesAsked = ''
const zonesDone = ref(false)
watch(
  () => [a.value?.id, restored.value, hasHr.value] as const,
  ([id, ready, hr]) => {
    if (!id || !ready || !hr || !a.value || zonesAsked === id) return
    zonesAsked = id
    zonesDone.value = false
    zones.load(a.value).finally(() => {
      if (zonesAsked === id) zonesDone.value = true
    })
  },
  { immediate: true },
)
const zonePick = computed(() => zones.pick(a.value))

const cardioState = computed<'loading' | 'error' | 'none' | 'ready'>(() => {
  if (!hasHr.value) return 'none'
  if (stream.value) {
    if (!stream.value.hr?.length) return 'none'
    // Une fois l'essai de cette visite terminé, on affiche ce qu'on a : jamais d'attente sans fin
    return a.value && !zonesDone.value && zones.pending(a.value) ? 'loading' : 'ready'
  }
  if (loadFailed.value) return 'error'
  return 'loading'
})
/* Retour : vers l'écran d'où l'on vient (connu seulement dans le navigateur, après le montage) */
const back = ref(backTarget(null))
onMounted(() => (back.value = backTarget(window.history.state?.back)))
const hrSettings = '/reglages/coureur'

/* ───── Kilomètres ou tours ───── */

const splits = computed(() => a.value?.splits ?? [])
const showSplits = computed(() => splits.value.length > 1 && result.value?.basis !== 'reps')
// Tours : sans séance reliée, et seulement s'ils disent autre chose que les kilomètres
const showLaps = computed(() => laps.value.length > 1 && !session.value && !(showSplits.value && autoKmLaps(laps.value)))
const splitRange = computed(() => ({ min: Math.min(...splits.value), max: Math.max(...splits.value) }))
const splitH = (s: number) => {
  const { min, max } = splitRange.value
  return max === min ? 70 : Math.round(35 + ((max - s) / (max - min)) * 65)
}
const lapDist = (m: number) => (m < 1000 ? `${Math.round(m)} m` : `${formatKm(m / 1000)} km`)

/* ───── Partage ───── */

const sharing = ref(false)

/** Image au format story : tracé ou graphique de la séance, titre et chiffres, dans le style du thème. */
async function shareImage() {
  const r = a.value
  if (!r) return
  sharing.value = true
  try {
    const rec = records.value[0]
    // Sur tapis : jamais de tracé inventé
    const points = r.indoor ? [] : r.route ? decodePolyline(r.route) : r.stravaId ? [] : demoRoute(r.id, r.type)
    const blob = await renderRunImage({
      title: displayTitle(r).title,
      type: RUN_TYPES[r.type].label,
      typeColor: RUN_TYPES[r.type].color,
      date: `${formatDay(r.startedAt)}${placeLabel(r) ? ` · ${placeLabel(r)}` : ''}`,
      stats: [
        { label: 'Distance', value: formatKm(r.distanceKm), unit: 'km' },
        { label: 'Durée', value: formatDuration(r.durationSec) },
        { label: 'Allure', value: formatPace(r.durationSec, r.distanceKm), unit: '/km' },
        r.avgHr ? { label: 'Cardio', value: String(r.avgHr), unit: 'bpm' } : { label: 'Dénivelé', value: String(r.elevationM), unit: 'm' },
      ],
      highlight: rec ? `Record sur ${rec.label} : ${formatDuration(rec.time)}` : undefined,
      points,
      // Sans tracé (tapis, GPS absent) : la séance tour par tour, comme en haut de cette page. Jamais un cadre vide
      chart:
        points.length > 1
          ? null
          : shareChart({ laps: r.laps, steps: session.value ? result.value?.steps : null, stream: stream.value, splits: r.splits, distanceKm: r.distanceKm, durationSec: r.durationSec }),
    })
    const how = await shareOrDownload(blob, `course-${r.localDate}.png`, displayTitle(r).title)
    if (how === 'downloaded') show('Image de la course téléchargée')
  } catch (e) {
    if ((e as Error).name !== 'AbortError') show('Impossible de créer l’image')
  } finally {
    sharing.value = false
  }
}
</script>

<template>
  <div class="stack stack--wide detail">
    <RunPending v-if="state !== 'ready' || !a" :state="state === 'missing' ? 'missing' : 'loading'" />
    <template v-else>
      <div class="topbar">
        <BackLink :to="back.to" :label="back.label" />
        <div class="top-actions">
          <button type="button" class="card icon-btn" :disabled="sharing" :aria-label="sharing ? 'Création de l’image…' : 'Partager en image'" @click="shareImage">
            <Share2 :size="19" aria-hidden="true" />
          </button>
          <a v-if="stravaUrl" :href="stravaUrl" target="_blank" rel="noopener" class="card icon-btn" aria-label="Voir sur Strava (nouvel onglet)">
            <BrandMark brand="strava" :size="22" />
          </a>
        </div>
      </div>

      <div class="col-a">
        <!-- En-tête visuel : la carte dehors -->
        <section v-if="hasMap" class="card hero hero--map sec" :style="{ '--c': typeColor, '--d': 0 }">
          <div class="map">
            <ClientOnly>
              <RouteMap :activity="a" />
              <template #fallback>
                <RouteTrace :activity="a" :width="1.6" :delay="200" />
              </template>
            </ClientOnly>
          </div>
          <div class="hero-text">
            <p class="eyebrow type">{{ RUN_TYPES[a.type].label }}<span v-if="a.typeReason" class="why"> · {{ a.typeReason }}</span></p>
            <h1 class="h1">{{ title.title }}</h1>
            <p class="label">{{ dateLine }}</p>
            <p v-if="sources.length || failed" class="tags">
              <span v-if="failed" class="tag tag--fail">Ratée</span>
              <span v-for="s in sources" :key="s" class="tag tag--src">{{ s }}</span>
            </p>
          </div>
        </section>

        <!-- En-tête visuel : la séance réalisée, tour par tour -->
        <section v-else class="card hero hero--laps sec" :style="{ '--c': typeColor, '--d': 0 }">
          <div class="hero-head">
            <div class="hero-id">
              <p class="eyebrow type">{{ RUN_TYPES[a.type].label }}<span v-if="a.typeReason" class="why"> · {{ a.typeReason }}</span></p>
              <h1 class="h1">{{ title.title }}</h1>
              <p class="label">{{ dateLine }}</p>
            </div>
            <p class="tags">
              <span v-if="a.indoor" class="tag tag--place">{{ placeLabel(a) || 'Tapis' }}</span>
              <span v-if="failed" class="tag tag--fail">Ratée</span>
              <span v-for="s in sources" :key="s" class="tag tag--src">{{ s }}</span>
            </p>
          </div>
          <LapProfile
            v-if="laps.length > 1"
            :laps="laps"
            :steps="session ? result?.steps : null"
            :stream="stream"
            :color="typeColor"
          />
          <p v-else class="no-laps fine">Pas de détail des tours pour cette course : seuls ses chiffres sont connus.</p>
        </section>

        <dl class="kpis sec" :style="{ '--d': 1 }">
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
          <div v-if="a.avgHr" class="card kpi" :class="{ 'kpi--span': !a.elevationM || a.indoor }" :style="{ '--k': 'var(--ko)', '--beat': `${(60 / a.avgHr).toFixed(3)}s` }">
            <dt class="eyebrow"><Heart class="heart" :size="11" fill="currentColor" aria-hidden="true" /> Cardio</dt>
            <dd class="num">{{ a.avgHr }}<span class="unit">bpm moy.</span><span v-if="a.maxHr" class="unit max">· max {{ a.maxHr }}</span></dd>
            <KpiPulse kind="hr" :value="a.avgHr" />
          </div>
          <div v-if="a.elevationM && !a.indoor" class="card kpi">
            <dt class="eyebrow"><Mountain :size="12" aria-hidden="true" /> Dénivelé</dt>
            <dd class="num">{{ a.elevationM }}<span class="unit">m</span></dd>
          </div>
        </dl>

        <div class="sec debrief-slot" :style="{ '--d': 2 }">
          <DebriefSummary v-if="debriefDone || debriefTodo" :activity="a" />
          <NuxtLink v-else :to="`/activites/${a.id}/debrief`" class="card row debrief-link">
            <span class="tile" aria-hidden="true"><ClipboardCheck :size="20" /></span>
            <span class="row__main">
              <span class="title">{{ debrief?.status === 'draft' ? 'Reprendre le débrief' : 'Débriefer cette course' }}</span>
              <span class="fine">Ressenti, analyse et publication sur Strava.</span>
            </span>
            <ArrowRight :size="18" aria-hidden="true" />
          </NuxtLink>
        </div>

        <div v-for="r in records" :key="r.key" class="block block--secondary record sec" :style="{ '--d': 6 }">
          <span class="trophy" aria-hidden="true"><Trophy :size="22" /></span>
          <span class="row__main">
            <span class="title">Record sur {{ r.label }} : {{ formatDuration(r.time) }}</span>
            <span v-if="r.previous" class="sub">{{ formatGain(r.previous - r.time) }} de mieux que ton ancien record ({{ formatDuration(r.previous) }})</span>
          </span>
        </div>

        <section v-if="a.shoe" class="card row shoe sec" :style="{ '--d': 7 }" aria-label="Chaussures">
          <span class="tile" :style="{ '--tile': 'var(--ink-2)' }" aria-hidden="true"><Footprints :size="20" /></span>
          <span class="row__main">
            <span class="eyebrow">Chaussures</span>
            <span class="title">{{ a.shoe.name }}</span>
          </span>
          <span class="shoe-km"><span class="num">{{ Math.round(a.shoe.km) }}</span> km</span>
        </section>
      </div>

      <div class="col-b">
        <PlanDone v-if="session" class="sec" :style="{ '--d': 3 }" :session="session" :steps="sessionSteps" :result="result" :outcome="outcome" />

        <CardioPanel
          class="sec"
          :style="{ '--d': 4 }"
          :stream="stream"
          :state="cardioState"
          :zones="zonePick"
          :settings-to="hrSettings"
          :avg-hr="a.avgHr || null"
          :peak-hr="a.maxHr || null"
          @retry="loadStream"
        />

        <section v-if="showSplits" class="card card--pad splits sec" :style="{ '--d': 5 }" aria-labelledby="splits-title">
          <div class="section-head">
            <h2 id="splits-title" class="eyebrow">Kilomètres</h2>
            <span class="label">meilleur km {{ formatPace(splitRange.min, 1) }}</span>
          </div>
          <ol class="split-bars" :style="{ '--n': splits.length }">
            <li v-for="(sp, k) in splits" :key="k" :style="{ '--k': k }" :aria-label="`Km ${k + 1} : ${formatPace(sp, 1)} par km`">
              <span class="sb" :class="{ best: sp === splitRange.min }" :style="{ height: `${splitH(sp)}%` }" />
              <span v-if="splits.length <= 14 || (k + 1) % 5 === 0" class="sk">{{ k + 1 }}</span>
            </li>
          </ol>
        </section>

        <section v-if="showLaps" class="card card--pad laps sec" :style="{ '--d': 5 }" aria-labelledby="laps-title">
          <div class="section-head">
            <h2 id="laps-title" class="eyebrow">Tours</h2>
            <span class="label">{{ laps.length }} tours</span>
          </div>
          <table class="lap-table">
            <thead>
              <tr><th scope="col">Tour</th><th scope="col">Distance</th><th scope="col">Temps</th><th scope="col">Allure</th><th scope="col">FC</th></tr>
            </thead>
            <tbody>
              <tr v-for="(l, k) in laps" :key="k">
                <td>{{ k + 1 }}</td>
                <td>{{ lapDist(l.m) }}</td>
                <td>{{ clock(l.sec) }}</td>
                <td>{{ l.m > 0 && l.sec >= 10 ? paceText(l.sec, l.m).replace(' /km', '') : '—' }}</td>
                <td>{{ l.hr ?? '—' }}</td>
              </tr>
            </tbody>
          </table>
        </section>
      </div>

      <p v-if="a.garminName" class="foot fine">Nom sur la montre : {{ a.garminName }}</p>
    </template>
  </div>
</template>

<style scoped>
.detail {
  gap: 14px;
}

/* Téléphone : les deux colonnes se fondent dans une seule, dans l'ordre de lecture */
.col-a,
.col-b {
  display: contents;
}

.topbar {
  order: 0;
}

.col-a > .hero {
  order: 1;
}

.col-a > .kpis {
  order: 2;
}

.col-a > .debrief-slot {
  order: 3;
}

.col-b > :nth-child(1) {
  order: 4;
}

.col-b > :nth-child(2) {
  order: 5;
}

.col-b > :nth-child(n + 3) {
  order: 6;
}

.col-a > .record {
  order: 7;
}

.col-a > .shoe {
  order: 8;
}

.foot {
  order: 9;
}

.sec {
  animation: rise 0.5s var(--ease-out) backwards;
  animation-delay: calc(60ms + var(--d, 0) * 50ms);
}

/* ── Barre du haut ── */
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.top-actions {
  display: flex;
  gap: 8px;
}

.icon-btn {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  padding: 0;
  border-radius: var(--r-btn);
  color: var(--ink);
  cursor: pointer;
  transition: transform 0.15s var(--ease-spring);
}

.icon-btn > * {
  position: relative;
  z-index: 1;
}

.icon-btn:active {
  transform: scale(0.92);
}

.icon-btn:disabled {
  opacity: 0.5;
}

/* ── En-tête ── */
.hero {
  overflow: hidden;
  border-radius: calc(var(--r-card) + 6px);
}

.type {
  color: var(--c);
}

.why {
  color: var(--muted);
  letter-spacing: 0.08em;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
}

.tag {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0 9px;
  border-radius: var(--r-pill);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.tag--src {
  font-family: var(--font-mono);
  color: var(--muted);
  box-shadow: inset 0 0 0 1px var(--line-strong);
}

.tag--place {
  color: var(--ink);
  background: var(--surface-2);
}

.tag--fail {
  color: var(--ko);
  background: color-mix(in srgb, var(--ko) 16%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ko) 45%, transparent);
}

/* Séance sur tapis : le profil des tours */
.hero--laps {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 20px 18px 18px;
}

.hero--laps::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: radial-gradient(90% 60% at 100% 0%, color-mix(in srgb, var(--c) 18%, transparent), transparent 70%);
  pointer-events: none;
}

.hero--laps > * {
  position: relative;
  z-index: 1;
}

.hero-head {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.hero-id {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.hero--laps .h1 {
  font-size: 30px;
}

.no-laps {
  padding: 14px;
  border-radius: var(--r-ctrl);
  background: var(--surface-2);
}

/* Dehors : la carte */
.hero--map::after {
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

.map {
  position: relative;
  z-index: 1;
  aspect-ratio: 1 / 0.95;
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
  pointer-events: none;
}

.hero-text .h1 {
  font-size: 30px;
  text-shadow: var(--title-shadow, 0 2px 20px rgba(0, 0, 0, 0.5));
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
  container-type: inline-size;
}

.kpi--wide {
  grid-column: 1 / -1;
  flex-direction: row;
  align-items: flex-end;
  justify-content: space-between;
}

.kpi--span {
  grid-column: 1 / -1;
}

.kpi dt {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--k, var(--muted));
}

/* Petit écran et police large : un « 1:20:00 » rétrécit un peu plutôt que de sortir de sa tuile */
.kpi dd {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 4px;
  margin: 0;
  font-size: min(28px, 21cqi);
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

.unit.max {
  color: var(--ink-2);
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

/* ── Débrief ── */
.debrief-slot {
  display: flex;
  flex-direction: column;
}

.debrief-link {
  gap: 14px;
  padding: 14px 16px;
}

.debrief-link > * {
  position: relative;
  z-index: 1;
}

.debrief-link .tile {
  --tile: var(--accent-text);
}

.debrief-link svg:last-child {
  color: var(--muted);
}

/* ── Records et chaussures ── */
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

.shoe {
  gap: 14px;
  padding: 14px 16px;
}

.shoe > * {
  position: relative;
  z-index: 1;
}

.shoe .row__main {
  gap: 4px;
}

.shoe-km {
  flex-shrink: 0;
  font-size: 13px;
  color: var(--muted);
}

.shoe-km .num {
  font-size: 22px;
  color: var(--ink);
}

/* ── Kilomètres ── */
.splits {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.splits .section-head,
.laps .section-head {
  margin-top: 0;
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
  border-radius: calc(var(--r-ctrl) * 0.4) calc(var(--r-ctrl) * 0.4) calc(var(--r-ctrl) * 0.2) calc(var(--r-ctrl) * 0.2);
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

/* ── Tours ── */
.laps {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.lap-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
  font-variant-numeric: tabular-nums;
}

.lap-table th {
  padding: 0 0 8px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  text-align: right;
  color: var(--muted);
}

.lap-table td {
  padding: 8px 0;
  border-top: 1px solid var(--line);
  text-align: right;
  font-family: var(--font-mono);
  color: var(--ink-2);
}

.lap-table th:first-child,
.lap-table td:first-child {
  text-align: left;
  color: var(--muted);
}

/* ── Pied ── */
.foot {
  padding: 4px 2px 0;
  overflow-wrap: anywhere;
}

/* Tablette : une colonne confortable */
@media (min-width: 720px) and (max-width: 859px) {
  .detail {
    max-width: 680px;
  }
}

/* Ordinateur : l'en-tête visuel, les chiffres et le débrief à gauche ; le détail de la séance à droite */
@media (min-width: 860px) {
  .detail {
    display: grid;
    grid-template-columns: minmax(0, 5fr) minmax(0, 6fr);
    align-items: start;
    gap: 16px 24px;
  }

  .topbar,
  .foot {
    grid-column: 1 / -1;
  }

  .col-a,
  .col-b {
    display: flex;
    flex-direction: column;
    gap: 14px;
    min-width: 0;
    animation: none;
  }

  .col-a {
    grid-column: 1;
  }

  .col-b {
    grid-column: 2;
  }

  .hero--laps .h1,
  .hero-text .h1 {
    font-size: 34px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .heart {
    animation: none;
  }
}
</style>
