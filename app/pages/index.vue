<script setup lang="ts">
import { ClipboardCheck, ChevronRight, Bell, CalendarClock, Heart, ArrowUpRight, CircleAlert } from 'lucide-vue-next'

useHead({ title: 'Aujourd’hui · stravaXgarmin' })

const { sorted, lastWeek } = useActivities()
const { toDebrief } = useDebriefs()
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
const hero = computed(() => sorted.value[0])
const latest = computed(() => sorted.value.slice(1, 4))
const { next: nextSession } = usePlan()
const heroDate = new Intl.DateTimeFormat('fr-BE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Brussels' })
// Courses à débriefer : la carte mène au Débrief de la plus récente
const firstToDebrief = computed(() => toDebrief.value[0])

// Lecture principale en échec (Strava, ou les noms Garmin) : une alerte discrète, seulement une fois la page montée
const { summary: health } = useHealth()
const mounted = ref(false)
onMounted(() => (mounted.value = true))
const healthAlert = computed(() => {
  if (!mounted.value) return null
  if (health.value.core === 'strava.activities') return 'Strava n’a pas répondu à la dernière lecture.'
  if (health.value.core === 'garmin.activities') return 'Garmin n’a pas répondu à la dernière lecture : les noms de ta montre peuvent manquer.'
  return null
})
</script>

<template>
  <LandingPage v-if="showLanding" />
  <div v-else class="stack stack--wide home">
    <header class="head">
      <div class="hello">
        <p class="eyebrow">{{ formatDay(`${TODAY}T12:00:00+01:00`) }}</p>
        <h1 class="h1 h1--xl">
          Salut<template v-if="firstName">&nbsp;<span class="ink-grad" :class="{ masked: demo }" :aria-label="demo ? 'nom masqué' : undefined">{{ firstName }}</span></template>
        </h1>
      </div>
      <div class="head-actions">
        <NuxtLink to="/notifications" class="bell card" :aria-label="unread ? `Notifications, ${unread} non lues` : 'Notifications'">
          <Bell :size="20" aria-hidden="true" />
          <span v-if="unread" :key="unread" class="badge" aria-hidden="true">{{ unread }}</span>
        </NuxtLink>
        <NuxtLink to="/reglages" class="avatar" aria-label="Mon compte"><span :class="{ masked: demo }">{{ (firstName || '?').charAt(0) }}</span></NuxtLink>
      </div>
    </header>

    <NuxtLink v-if="healthAlert" to="/reglages/etat" class="card row health-alert" role="alert">
      <span class="tile" style="--tile: var(--ko)" aria-hidden="true"><CircleAlert :size="22" /></span>
      <span class="row__main">
        <span class="alert-text">{{ healthAlert }}</span>
        <span class="alert-link">Voir l’état des connexions</span>
      </span>
      <ChevronRight :size="20" aria-hidden="true" />
    </NuxtLink>

    <section v-if="!hasData && accounts.strava.connected && !synced" class="card card--pad loading" aria-busy="true">
      <span class="spinner" aria-hidden="true" />
      <p class="lead">Chargement de tes courses Strava…</p>
    </section>

    <section v-else-if="!hasData" class="card card--pad">
      <h2 class="h2">Aucune course sur les 60 derniers jours</h2>
      <p class="lead">Dès qu’une course arrive sur Strava, elle apparaîtra ici.</p>
    </section>

    <template v-else>
      <!-- Sur téléphone ces deux colonnes se fondent en une seule, dans l'ordre voulu (voir le style) -->
      <div class="col-main">
        <section class="block block--primary week" aria-labelledby="week-title">
          <div class="week-top">
            <p id="week-title" class="eyebrow on">7 derniers jours</p>
            <span class="sync-pill">{{ week.synced }}/{{ week.count }} synchro</span>
          </div>
          <p class="num big"><CountUp :value="week.km" :decimals="1" :delay="250" /><span class="unit">km</span></p>
          <dl class="week-stats">
            <div><dt>Courses</dt><dd class="num">{{ week.count }}</dd></div>
            <div><dt>Temps</dt><dd class="num">{{ formatHours(week.sec) }}</dd></div>
            <div v-if="recap.deltaPct !== null"><dt>vs sem. passée</dt><dd class="num">{{ recap.deltaPct > 0 ? '+' : '' }}{{ recap.deltaPct }} %</dd></div>
          </dl>
          <ol class="bars" aria-label="Kilomètres par jour">
            <li v-for="(d, i) in week.days" :key="d.key" :style="{ '--b': i }">
              <span class="bar-zone">
                <span class="bar" :class="{ off: !d.km }" :style="{ height: `${d.km ? Math.max((d.km / maxKm) * 100, 18) : 6}%` }" />
              </span>
              <span class="day" :aria-label="`${d.letter} : ${formatKm(d.km)} km`">{{ d.letter }}</span>
            </li>
          </ol>
        </section>
        <NuxtLink v-if="hero" :to="`/activites/${hero.id}`" class="card hero-run" :style="{ '--c': RUN_TYPES[hero.type].color }">
          <div class="hero-map">
            <RunThumb :activity="hero" :width="2.2" draw />
          </div>
          <div class="hero-info">
            <p class="eyebrow">Dernière course · {{ heroDate.format(new Date(hero.startedAt)) }}<template v-if="hero.indoor"> · {{ placeLabel(hero) }}</template></p>
            <h2 class="hero-title">{{ displayTitle(hero).title }}</h2>
            <dl class="hero-stats">
              <div><dd class="num">{{ formatKm(hero.distanceKm) }}</dd><dt>km</dt></div>
              <div><dd class="num">{{ formatPace(hero.durationSec, hero.distanceKm) }}</dd><dt>/km</dt></div>
              <div v-if="hero.avgHr"><dd class="num">{{ hero.avgHr }}</dd><dt><Heart :size="11" fill="currentColor" aria-hidden="true" /> bpm</dt></div>
            </dl>
          </div>
        </NuxtLink>
      </div>
      <div class="col-side">
        <GoalCard compact />
        <NuxtLink v-if="nextSession" to="/journal?onglet=a-venir" class="card next">
          <div class="next-head">
            <span class="next-icon" aria-hidden="true"><CalendarClock :size="20" /></span>
            <span class="row__main">
              <span class="eyebrow">Prochaine séance · {{ planDay(nextSession.date) }}</span>
              <span class="title next-title">{{ nextSession.title }}</span>
            </span>
            <ArrowUpRight class="go" :size="20" aria-hidden="true" />
          </div>
          <WorkoutProfile v-if="nextSession.blocks.length" :blocks="nextSession.blocks" :height="44" />
          <p class="next-meta">
            <span v-if="nextSession.durationSec">{{ formatHours(nextSession.durationSec) }}</span>
            <span v-if="nextSession.distanceM">{{ formatKm(nextSession.distanceM / 1000) }} km</span>
            <span v-if="nextSession.provider" class="provider">{{ nextSession.provider }}</span>
          </p>
        </NuxtLink>
        <NuxtLink v-if="firstToDebrief" :to="`/activites/${firstToDebrief.id}/debrief`" class="block block--secondary ai">
          <span class="ai-icon" aria-hidden="true"><ClipboardCheck :size="22" /></span>
          <span class="row__main">
            <span class="title">{{ toDebrief.length }} course{{ toDebrief.length > 1 ? 's' : '' }} à débriefer</span>
            <span class="ai-text">« {{ displayTitle(firstToDebrief).title }} » : vingt secondes pour boucler ta séance.</span>
          </span>
          <ChevronRight :size="20" aria-hidden="true" />
        </NuxtLink>
      </div>

      <NuxtLink to="/journal" class="link all">Ton journal <ChevronRight :size="16" aria-hidden="true" /></NuxtLink>
    </template>
  </div>
</template>

<style scoped>
.home {
  gap: 18px;
}

.head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  padding-top: 4px;
}

.hello {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
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
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
}

.badge {
  position: absolute;
  z-index: 1;
  top: -3px;
  right: -3px;
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
  box-shadow: 0 0 0 3px var(--bg);
  animation: pop 0.5s var(--ease-spring) 0.6s backwards;
}

.avatar {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--primary);
  color: var(--on-primary);
  font-weight: 800;
  box-shadow: 0 0 0 2px var(--bg), 0 0 0 3.5px color-mix(in srgb, var(--primary-solid) 60%, transparent), var(--primary-shadow);
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

/* ── Semaine ── */
.week {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 22px 22px 18px;
  border-radius: calc(var(--r-card) + 4px);
}

.week > * {
  position: relative;
  z-index: 1;
}

.week-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.eyebrow.on {
  color: currentColor;
  opacity: 0.85;
}

.sync-pill {
  padding: 4px 10px;
  border-radius: 99px;
  font-size: 12px;
  font-weight: 700;
  background: color-mix(in srgb, currentColor 20%, transparent);
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
}

.big {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin: 10px 0 6px;
  font-size: 72px;
  letter-spacing: -0.05em;
}

.unit {
  font-size: 22px;
  letter-spacing: 0;
  opacity: 0.8;
}

.week-stats {
  display: flex;
  gap: 22px;
  margin: 0;
}

.week-stats div {
  display: flex;
  flex-direction: column-reverse;
  gap: 2px;
}

.week-stats dt {
  font-size: 12px;
  opacity: 0.78;
}

.week-stats dd {
  margin: 0;
  font-size: 20px;
}

.bars {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 8px;
  margin: 18px 0 0;
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
  height: 56px;
}

.bar {
  width: 100%;
  max-width: 26px;
  border-radius: 8px;
  background: linear-gradient(180deg, currentColor, color-mix(in srgb, currentColor 55%, transparent));
  box-shadow: 0 0 18px color-mix(in srgb, currentColor 35%, transparent);
  transform-origin: bottom;
  animation: grow 0.8s var(--ease-spring) backwards;
  animation-delay: calc(300ms + var(--b) * 55ms);
}

.bar.off {
  background: color-mix(in srgb, currentColor 22%, transparent);
  box-shadow: none;
}

.day {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  opacity: 0.8;
}

/* ── Prochaine séance ── */
.next {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px;
}

.next-head {
  display: flex;
  align-items: center;
  gap: 12px;
}

.next-icon {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 42px;
  height: 42px;
  border-radius: var(--r-ctrl);
  color: var(--accent-text);
  background: color-mix(in srgb, var(--accent-text) 16%, transparent);
}

.next-title {
  font-size: 18px;
}

.next-meta {
  display: flex;
  gap: 14px;
  margin: 0;
  font-size: 13px;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}

.provider {
  margin-left: auto;
  font-weight: 700;
  color: var(--ink-2);
}

.go {
  color: var(--muted);
  flex-shrink: 0;
}

/* ── Dernière course ── */
.hero-run {
  display: grid;
  grid-template-columns: 132px 1fr;
  gap: 16px;
  align-items: center;
  padding: 16px;
  overflow: hidden;
}

.hero-run::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: radial-gradient(70% 90% at 0% 50%, color-mix(in srgb, var(--c) 22%, transparent), transparent 70%);
  pointer-events: none;
}

.hero-map {
  position: relative;
  z-index: 1;
  aspect-ratio: 1;
  padding: 6px;
}

.hero-info {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.hero-title {
  margin: 0;
  font-family: var(--font-display);
  font-weight: var(--display-weight);
  font-size: 20px;
  line-height: 1.15;
  letter-spacing: -0.02em;
}

.hero-stats {
  display: flex;
  gap: 14px;
  margin: 6px 0 0;
}

.hero-stats div {
  display: flex;
  flex-direction: column;
}

.hero-stats dd {
  margin: 0;
  font-size: 22px;
}

.hero-stats dt {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  font-weight: 700;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.hero-stats dt svg {
  color: var(--ko);
}

.health-alert {
  align-items: center;
}

.alert-text {
  font-weight: 600;
  line-height: 1.35;
}

.alert-link {
  font-size: 15px;
  font-weight: 600;
  color: var(--accent-text);
}

/*
 * Téléphone : une seule colonne, dans l'ordre semaine, objectif, prochaine séance,
 * dernière course, titres à revoir. Les deux colonnes n'existent qu'en grand écran.
 */
.col-main,
.col-side {
  display: contents;
}

.col-main > *,
.col-side > * {
  animation: rise 0.5s var(--ease-out) 120ms backwards;
}

.week {
  order: 1;
}

.col-side > :deep(.goal) {
  order: 2;
}

.next {
  order: 3;
}

.hero-run {
  order: 4;
  animation-delay: 220ms;
}

.ai {
  order: 5;
  animation-delay: 280ms;
}

.all {
  order: 6;
}

/* Tablette et ordinateur : semaine et dernière course à gauche, le reste dans une colonne à droite */
@media (min-width: 720px) {
  .home {
    display: grid;
    grid-template-columns: repeat(12, minmax(0, 1fr));
    align-items: start;
    gap: 20px;
  }

  .home > * {
    grid-column: 1 / -1;
  }

  .home > .col-main,
  .home > .col-side {
    display: flex;
    flex-direction: column;
    gap: 20px;
    min-width: 0;
  }

  .home > .col-main {
    grid-column: 1 / span 7;
  }

  .home > .col-side {
    grid-column: 8 / -1;
  }

  .week {
    padding: 28px 28px 24px;
  }

  .big {
    font-size: 96px;
  }

  .bar-zone {
    height: 120px;
  }

  .bar {
    max-width: 40px;
  }

  .hero-run {
    grid-template-columns: 180px 1fr;
    padding: 22px;
  }

  .hero-title {
    font-size: 26px;
  }
}

/* ── Titres à revoir, récap ── */
.ai {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
}

.ai > * {
  position: relative;
  z-index: 1;
}

.ai-icon {
  animation: pop 0.6s var(--ease-spring) 0.45s backwards;
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  border-radius: var(--r-ctrl);
  background: color-mix(in srgb, currentColor 18%, transparent);
}

.ai-text {
  font-size: 15px;
  opacity: 0.85;
}

.all {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  align-self: center;
}
</style>
