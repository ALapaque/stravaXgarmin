<script setup lang="ts">
import { Sparkles, ChevronRight } from 'lucide-vue-next'

useHead({ title: 'Accueil · stravaXgarmin' })

const { activities, toReview, lastWeek } = useActivities()
const week = lastWeek
const maxKm = computed(() => Math.max(...week.value.days.map((d) => d.km), 1))
const latest = computed(() => activities.value.slice(0, 3))
const firstToReview = computed(() => toReview.value[0])
</script>

<template>
  <header class="head">
    <div>
      <p class="label">{{ formatDay(`${TODAY}T12:00:00+01:00`) }}</p>
      <h1 class="h1">Salut Arlioz</h1>
    </div>
    <NuxtLink to="/reglages" class="avatar" aria-label="Mon compte">A</NuxtLink>
  </header>

  <section class="block block--primary week" aria-labelledby="week-title">
    <p id="week-title" class="label">7 derniers jours</p>
    <p class="num big">{{ formatKm(week.km) }} km</p>
    <p class="label">
      {{ week.count }} courses · {{ formatHours(week.sec) }} · {{ week.synced }} sur {{ week.count }} synchronisées
    </p>
    <ol class="bars" aria-label="Kilomètres par jour">
      <li v-for="d in week.days" :key="d.key">
        <span class="bar-zone">
          <span class="bar" :class="{ off: !d.km }" :style="{ height: `${d.km ? Math.max((d.km / maxKm) * 100, 18) : 8}%` }" />
        </span>
        <span class="label day" :aria-label="`${d.letter} : ${formatKm(d.km)} km`">{{ d.letter }}</span>
      </li>
    </ol>
  </section>

  <NuxtLink
    v-if="firstToReview"
    :to="`/activites/${firstToReview.id}/titre`"
    class="block block--secondary ai"
  >
    <span class="ai-icon" aria-hidden="true"><Sparkles :size="22" /></span>
    <span class="row__main">
      <span class="title">{{ toReview.length }} titre{{ toReview.length > 1 ? 's' : '' }} à revoir</span>
      <span class="ai-text">« {{ firstToReview.stravaName }} » a des remplaçants prêts.</span>
    </span>
    <ChevronRight :size="20" aria-hidden="true" />
  </NuxtLink>

  <div class="section-head">
    <h2 class="h2">Dernières courses</h2>
    <NuxtLink to="/activites" class="link">Tout voir</NuxtLink>
  </div>

  <div class="card list">
    <ActivityRow v-for="a in latest" :key="a.id" :activity="a" />
  </div>
</template>

<style scoped>
.head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
}

.head .h1 {
  font-size: 28px;
}

.avatar {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--primary);
  color: var(--on-primary);
  font-weight: 700;
}

.week {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.big {
  margin: 4px 0;
  font-size: 56px;
}

.bars {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 8px;
  margin: 12px 0 0;
  padding: 0;
  list-style: none;
}

.bars li {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.bar-zone {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  width: 100%;
  height: 48px;
}

.bar {
  width: 100%;
  max-width: 28px;
  border-radius: 6px;
  background: currentColor;
  opacity: 0.9;
}

.bar.off {
  opacity: 0.25;
}

.day {
  text-transform: uppercase;
}

.ai {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
}

.ai-icon {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  border-radius: 12px;
  background: color-mix(in srgb, currentColor 18%, transparent);
}

.ai-text {
  font-size: 15px;
  opacity: 0.85;
}
</style>
