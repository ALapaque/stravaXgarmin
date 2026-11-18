<script setup lang="ts">
import { Sparkles, ChartLine, Check, Trophy, Heart } from 'lucide-vue-next'

const route = useRoute()
const { byId, isSynced, setStravaName, setStravaDescription } = useActivities()
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

function undoLast(message: string) {
  return {
    label: 'Annuler',
    run: () => {
      const last = entries.value[0]
      if (last && undo(last.id)) show(message)
    },
  }
}

function copyName() {
  if (!a.value) return
  setStravaName(a.value.id, a.value.garminName, 'garmin')
  show('Nom copié vers Strava', undoLast('Ancien nom remis sur Strava'))
  notify({ kind: 'titles', title: 'Nom copié vers Strava', body: a.value.garminName, to: `/activites/${a.value.id}` })
}

function addDescription() {
  if (!a.value || !description.value) return
  setStravaDescription(a.value.id, description.value)
  show('Description ajoutée sur Strava', undoLast('Description retirée de Strava'))
}
</script>

<template>
  <div class="stack">
    <template v-if="a">
      <BackLink to="/activites" label="Activités" />

      <div class="title-block">
        <h1 class="h1">{{ a.garminName }}</h1>
        <p class="label">{{ formatDay(a.startedAt) }} · {{ a.place }} · {{ formatTime(a.startedAt) }}</p>
      </div>

      <div v-for="r in records" :key="r.key" class="block block--secondary record">
        <span class="trophy" aria-hidden="true"><Trophy :size="22" /></span>
        <span class="row__main">
          <span class="title">Record sur {{ r.label }} : {{ formatDuration(r.time) }}</span>
          <span v-if="r.previous" class="sub">{{ r.previous - r.time }} s de mieux que ton ancien record ({{ formatDuration(r.previous) }})</span>
        </span>
      </div>

      <dl class="card kpis">
        <div class="kpi">
          <dt class="label" style="color: var(--type-interval)">km</dt>
          <dd class="num">{{ formatKm(a.distanceKm) }}</dd>
        </div>
        <div class="kpi">
          <dt class="label" style="color: var(--info)">durée</dt>
          <dd class="num">{{ formatDuration(a.durationSec) }}</dd>
        </div>
        <div class="kpi" style="color: var(--ok)">
          <dt class="label">/km</dt>
          <dd class="num">{{ formatPace(a.durationSec, a.distanceKm) }}</dd>
          <KpiPulse kind="pace" :value="paceSec" />
        </div>
        <div class="kpi" :style="{ color: 'var(--ko)', '--beat': `${(60 / a.avgHr).toFixed(3)}s` }">
          <dt class="label"><Heart class="heart" :size="12" fill="currentColor" aria-hidden="true" /> bpm</dt>
          <dd class="num">{{ a.avgHr }}</dd>
          <KpiPulse kind="hr" :value="a.avgHr" />
        </div>
      </dl>

      <section class="card list" aria-labelledby="names-title">
        <div class="row names-head">
          <h2 id="names-title" class="title">Nom de l’activité</h2>
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

      <div class="btn-row">
        <NuxtLink :to="`/activites/${a.id}/titre`" class="btn btn--secondary">
          <Sparkles :size="20" aria-hidden="true" /> Titre
        </NuxtLink>
        <NuxtLink :to="`/activites/${a.id}/analyse`" class="btn btn--secondary">
          <ChartLine :size="20" aria-hidden="true" /> Analyser
        </NuxtLink>
      </div>

      <button v-if="!synced" type="button" class="btn btn--primary" @click="copyName">
        Copier le nom vers Strava
        <Check :size="20" aria-hidden="true" />
      </button>

      <section v-if="settings.description.enabled && description" class="card card--pad desc" aria-labelledby="desc-title">
        <div class="desc-head">
          <h2 id="desc-title" class="title">Description Strava</h2>
          <StatusChip v-if="descriptionAdded" ok label="Ajoutée" />
        </div>
        <p class="desc-text">{{ a.stravaDescription || description }}</p>
        <button v-if="!descriptionAdded" type="button" class="btn btn--secondary btn--sm" @click="addDescription">
          Ajouter sur Strava
        </button>
      </section>
    </template>
  </div>
</template>

<style scoped>
.title-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.record {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
}

.trophy {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: color-mix(in srgb, currentColor 18%, transparent);
  animation: pop 0.7s var(--ease-spring) 0.35s backwards;
}

.record .sub {
  font-size: 15px;
  opacity: 0.85;
}

.kpis {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  margin: 0;
}

.kpi {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 16px 10px 14px 14px;
  min-width: 0;
}

.kpi + .kpi {
  border-left: 1px solid var(--line);
}

.kpi dt {
  order: 2;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: inherit;
  opacity: 1;
}

.kpi dd {
  order: 1;
  margin: 0;
  font-size: 22px;
  color: var(--ink);
}

.kpi :deep(.pulse) {
  order: 3;
  margin-top: 4px;
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

.names-head {
  justify-content: space-between;
  min-height: 56px;
}

.names-head h2,
.desc-head h2 {
  margin: 0;
  font-size: 16px;
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
