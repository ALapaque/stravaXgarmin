<script setup lang="ts">
import { Share2, Trophy, TrendingUp, TrendingDown } from 'lucide-vue-next'
import type { RecapKind } from '~/composables/useRecap'

useHead({ title: 'Récap · stravaXgarmin' })

const route = useRoute()
const kind = ref<RecapKind>(route.query.p === 'mois' ? 'mois' : 'semaine')
const recap = useRecap(kind)
const { show } = useToast()
const sharing = ref(false)
const { sorted } = useActivities()
const { accounts } = useAccounts()
const { active: demo } = useDemo()

const maxBar = computed(() => Math.max(...recap.value.bars.map((b) => b.km), 1))
const deltaText = computed(() => {
  const d = recap.value.deltaPct
  if (d === null) return null
  return `${d > 0 ? '+' : ''}${d} % par rapport à ${recap.value.compareLabel}`
})

async function share() {
  sharing.value = true
  try {
    const r = recap.value
    const blob = await renderRecapImage({
      period: r.title,
      km: formatKm(r.km),
      delta: r.deltaPct === null ? null : `${r.deltaPct > 0 ? '+' : ''}${r.deltaPct} %`,
      stats: [
        { label: 'courses', value: String(r.count) },
        { label: 'temps', value: formatHours(r.sec) },
        { label: 'allure /km', value: r.pace },
        { label: 'dénivelé', value: `${r.elevation} m` },
      ],
      bars: r.bars.map((b) => ({ label: b.label, km: b.km })),
      highlight: r.records[0]
        ? `Record sur ${r.records[0].label} : ${formatDuration(r.records[0].time)}`
        : r.longest
          ? `Plus longue sortie : ${formatKm(r.longest.distanceKm)} km`
          : undefined,
    })
    const how = await shareOrDownload(blob, `recap-${kind.value}.png`, `Mon récap · ${r.title}`)
    if (how === 'downloaded') show('Image du récap téléchargée')
  } catch (e) {
    if ((e as Error).name !== 'AbortError') show('Impossible de créer l’image')
  } finally {
    sharing.value = false
  }
}
</script>

<template>
  <div class="stack">
    <BackLink to="/stats" label="Stats" />
    <h1 class="h1">Récap</h1>

    <ConnectPrompt v-if="!sorted.length && !accounts.strava.connected && !demo" text="Ton récap de la semaine et du mois apparaîtra ici une fois Strava connecté." />

    <template v-else>
    <div class="segmented" role="group" aria-label="Période du récap">
      <button type="button" :aria-pressed="kind === 'semaine'" @click="kind = 'semaine'">Semaine</button>
      <button type="button" :aria-pressed="kind === 'mois'" @click="kind = 'mois'">Mois</button>
    </div>

    <!-- La clé force l'animation d'apparition à chaque changement de période -->
    <div :key="kind" class="stack">
      <section class="block block--primary hero">
        <p class="label">{{ recap.title }}</p>
        <p class="num big"><CountUp :value="recap.km" :decimals="1" :delay="80" /> km</p>
        <p v-if="deltaText" class="delta">
          <component :is="(recap.deltaPct ?? 0) >= 0 ? TrendingUp : TrendingDown" :size="18" aria-hidden="true" />
          {{ deltaText }}
        </p>
      </section>

      <dl class="grid-2 stats">
        <div class="card stat"><dt class="label">courses</dt><dd class="num">{{ recap.count }}</dd></div>
        <div class="card stat"><dt class="label">temps</dt><dd class="num">{{ formatHours(recap.sec) }}</dd></div>
        <div class="card stat"><dt class="label">allure /km</dt><dd class="num">{{ recap.pace }}</dd></div>
        <div class="card stat"><dt class="label">dénivelé</dt><dd class="num">{{ recap.elevation }} m</dd></div>
      </dl>

      <section class="card card--pad chart" aria-label="Kilomètres par période">
        <ol class="bars">
          <li v-for="(b, i) in recap.bars" :key="b.label" :style="{ '--b': i }">
            <span class="value label">{{ b.km ? formatKm(b.km) : '' }}</span>
            <span class="zone">
              <span class="bar" :class="{ off: !b.km, future: b.future }" :style="{ height: `${b.km ? Math.max((b.km / maxBar) * 100, 10) : 6}%` }" />
            </span>
            <span class="label">{{ b.label }}</span>
          </li>
        </ol>
      </section>

      <div v-if="recap.records.length || recap.longest" class="card list">
        <NuxtLink v-for="r in recap.records" :key="r.key + r.activity.id" :to="`/activites/${r.activity.id}`" class="row">
          <span class="tile" style="--tile: var(--ok)" aria-hidden="true"><Trophy :size="22" /></span>
          <span class="row__main">
            <span class="title">Record sur {{ r.label }} : {{ formatDuration(r.time) }}</span>
            <span class="label">{{ r.activity.garminName }}</span>
          </span>
        </NuxtLink>
        <NuxtLink v-if="recap.longest" :to="`/activites/${recap.longest.id}`" class="row">
          <ActivityTile :type="recap.longest.type" />
          <span class="row__main">
            <span class="title">Plus longue sortie : {{ formatKm(recap.longest.distanceKm) }} km</span>
            <span class="label">{{ recap.longest.garminName }}</span>
          </span>
        </NuxtLink>
      </div>

      <WeekReview v-if="kind === 'semaine'" />

      <button type="button" class="btn btn--primary" :disabled="sharing" @click="share">
        {{ sharing ? 'Création de l’image…' : 'Partager le récap' }}
        <Share2 :size="20" aria-hidden="true" />
      </button>
    </div>
    </template>
  </div>
</template>

<style scoped>
.hero {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.big {
  margin: 4px 0;
  font-size: 56px;
}

.delta {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  font-weight: 600;
  font-size: 15px;
}

.stats {
  margin: 0;
}

.stat {
  display: flex;
  flex-direction: column-reverse;
  gap: 6px;
  padding: 18px;
}

.stat dd {
  margin: 0;
  font-size: 28px;
}

.bars {
  display: flex;
  gap: 8px;
  height: 160px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.bars li {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.value {
  min-height: 18px;
  font-size: 12px;
}

.zone {
  flex: 1;
  width: 100%;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.bar {
  width: 100%;
  max-width: 34px;
  border-radius: 8px;
  background: var(--primary);
  transform-origin: bottom;
  animation: grow 0.7s var(--ease-spring) backwards;
  animation-delay: calc(200ms + var(--b) * 60ms);
}

.bar.off {
  background: var(--line-strong);
}

.bar.future {
  opacity: 0.4;
}
</style>
