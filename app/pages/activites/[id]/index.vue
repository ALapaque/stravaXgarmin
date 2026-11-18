<script setup lang="ts">
import { Sparkles, ChartLine, Check } from 'lucide-vue-next'

const route = useRoute()
const { byId, isSynced, setStravaName } = useActivities()
const { show } = useToast()

const a = computed(() => byId(String(route.params.id)))
if (!a.value) throw createError({ statusCode: 404, statusMessage: 'Activité introuvable' })

useHead({ title: () => `${a.value?.garminName} · stravaXgarmin` })

const synced = computed(() => (a.value ? isSynced(a.value) : false))
const kpis = computed(() => {
  const x = a.value!
  return [
    { value: formatKm(x.distanceKm), unit: 'km', color: 'var(--type-interval)' },
    { value: formatDuration(x.durationSec), unit: 'durée', color: 'var(--info)' },
    { value: formatPace(x.durationSec, x.distanceKm), unit: '/km', color: 'var(--ok)' },
    { value: String(x.avgHr), unit: 'bpm', color: 'var(--ko)' },
  ]
})

function copyName() {
  if (!a.value) return
  // TODO: PUT /activities/{id} sur l'API Strava (scope activity:write)
  setStravaName(a.value.id, a.value.garminName)
  show('Nom copié vers Strava')
}
</script>

<template>
  <template v-if="a">
    <BackLink to="/activites" label="Activités" />

    <div class="title-block">
      <h1 class="h1">{{ a.garminName }}</h1>
      <p class="label">{{ formatDay(a.startedAt) }} · {{ a.place }} · {{ formatTime(a.startedAt) }}</p>
    </div>

    <dl class="card kpis">
      <div v-for="k in kpis" :key="k.unit" class="kpi">
        <dt class="label" :style="{ color: k.color }">{{ k.unit }}</dt>
        <dd class="num">{{ k.value }}</dd>
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
        <Sparkles :size="20" aria-hidden="true" /> Titre IA
      </NuxtLink>
      <NuxtLink :to="`/activites/${a.id}/analyse`" class="btn btn--secondary">
        <ChartLine :size="20" aria-hidden="true" /> Analyser
      </NuxtLink>
    </div>

    <button v-if="!synced" type="button" class="btn btn--primary" @click="copyName">
      Copier le nom vers Strava
      <Check :size="20" aria-hidden="true" />
    </button>
    <p v-else class="fine done">Les deux noms sont identiques.</p>
  </template>
</template>

<style scoped>
.title-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.kpis {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  margin: 0;
}

.kpi {
  display: flex;
  flex-direction: column-reverse;
  gap: 4px;
  padding: 16px 12px 16px 14px;
}

.kpi + .kpi {
  border-left: 1px solid var(--line);
}

.kpi dd {
  margin: 0;
  font-size: 22px;
}

.names-head {
  justify-content: space-between;
  min-height: 56px;
}

.names-head h2 {
  margin: 0;
  font-size: 16px;
}

.done {
  text-align: center;
  padding: 16px 0;
}
</style>
