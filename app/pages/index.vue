<script setup lang="ts">
import { Sparkles, ChevronRight, Bell, CalendarRange } from 'lucide-vue-next'

useHead({ title: 'Accueil · stravaXgarmin' })

const { sorted, toReview, lastWeek } = useActivities()
const { unread } = useNotifications()
const { accounts } = useAccounts()
const { active: demo } = useDemo()
const { synced } = useSync()
const hasData = computed(() => sorted.value.length > 0)
// En démo, un prénom fictif et flouté ; sinon le prénom du compte Strava
const firstName = computed(() => (demo.value ? 'Alex' : (accounts.value.strava.name ?? '').split(' ')[0]))

/*
 * Sans compte ni démo, la présentation s'affiche directement ici plutôt que par une
 * redirection : sur iPhone, une app installée dont la page de départ redirige
 * s'ouvre avec la barre du navigateur.
 */
const showLanding = computed(() => !accounts.value.strava.connected && !demo.value && !hasData.value)
// Le layout initial est choisi par le middleware ; ici on suit les changements (démo, connexion)
watch(showLanding, (v) => setPageLayout(v ? 'bare' : 'default'))
const recap = useRecap(ref('semaine'))
const week = lastWeek
const maxKm = computed(() => Math.max(...week.value.days.map((d) => d.km), 1))
const latest = computed(() => sorted.value.slice(0, 3))
const firstToReview = computed(() => toReview.value[0])
</script>

<template>
  <LandingPage v-if="showLanding" />
  <div v-else class="stack">
    <header class="head">
      <div>
        <p class="label">{{ formatDay(`${TODAY}T12:00:00+01:00`) }}</p>
        <h1 class="h1">
          Salut<template v-if="firstName">&nbsp;<span :class="{ masked: demo }" :aria-label="demo ? 'nom masqué' : undefined">{{ firstName }}</span></template>
        </h1>
      </div>
      <div class="head-actions">
        <NuxtLink to="/notifications" class="bell" :aria-label="unread ? `Notifications, ${unread} non lues` : 'Notifications'">
          <Bell :size="22" aria-hidden="true" />
          <span v-if="unread" :key="unread" class="badge" aria-hidden="true">{{ unread }}</span>
        </NuxtLink>
        <NuxtLink to="/reglages" class="avatar" aria-label="Mon compte"><span :class="{ masked: demo }">{{ (firstName || '?').charAt(0) }}</span></NuxtLink>
      </div>
    </header>

    <section v-if="!hasData && accounts.strava.connected && !synced" class="card card--pad loading" aria-busy="true">
      <span class="spinner" aria-hidden="true" />
      <p class="lead">Chargement de tes courses Strava…</p>
    </section>

    <section v-else-if="!hasData" class="card card--pad">
      <h2 class="h2">Aucune course sur les 60 derniers jours</h2>
      <p class="lead">Dès qu’une course arrive sur Strava, elle apparaîtra ici.</p>
    </section>

    <template v-else>
    <section class="block block--primary week" aria-labelledby="week-title">
      <p id="week-title" class="label">7 derniers jours</p>
      <p class="num big"><CountUp :value="week.km" :decimals="1" :delay="250" /> km</p>
      <p class="label">
        {{ week.count }} courses · {{ formatHours(week.sec) }} · {{ week.synced }} sur {{ week.count }} synchronisées
      </p>
      <ol class="bars" aria-label="Kilomètres par jour">
        <li v-for="(d, i) in week.days" :key="d.key" :style="{ '--b': i }">
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

    <NuxtLink to="/recap" class="card recap">
      <span class="tile" style="--tile: var(--info)" aria-hidden="true"><CalendarRange :size="22" /></span>
      <span class="row__main">
        <span class="title">Récap de la semaine</span>
        <span class="label">
          {{ formatKm(recap.km) }} km · {{ recap.count }} courses<template v-if="recap.deltaPct !== null"> · {{ recap.deltaPct > 0 ? '+' : '' }}{{ recap.deltaPct }} %</template>
        </span>
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

.masked {
  filter: blur(7px);
  user-select: none;
}

.head-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.bell {
  position: relative;
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--surface);
  border: 1px solid var(--surface-border);
}

.badge {
  position: absolute;
  top: -2px;
  right: -2px;
  display: grid;
  place-items: center;
  min-width: 20px;
  height: 20px;
  padding: 0 5px;
  border-radius: 10px;
  background: var(--ko);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  animation: pop 0.5s var(--ease-spring) 0.6s backwards;
}

.loading {
  display: flex;
  align-items: center;
  gap: 14px;
}

.spinner {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 3px solid var(--line-strong);
  border-top-color: var(--accent-text);
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.recap {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
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
  transform-origin: bottom;
  animation: grow 0.7s var(--ease-spring) backwards;
  animation-delay: calc(300ms + var(--b) * 55ms);
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
  animation: pop 0.6s var(--ease-spring) 0.45s backwards;
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
