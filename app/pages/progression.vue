<script setup lang="ts">
/*
 * Progression : « suis-je régulier ? est-ce que je progresse ? est-ce que je risque de me blesser ? ». Rubriques :
 * - Régularité (par défaut) : plan suivi sur 8 semaines, semaine par semaine, série en cours, charge, bilan ;
 *   sans plan connu, les courses par semaine ;
 * - Forme : forme Garmin et objectif ; sans Garmin, l'estimation du niveau par l'IA en repli ;
 * - Records : meilleurs temps, puis compétitions ;
 * - Matériel : chaussures et seuil d'usure.
 * Règles : shared/utils/progress.ts (plan suivi, série, courses par semaine, compétitions).
 */
import { CalendarDays, CalendarCheck, ChevronRight, Flame, Medal, Sparkles, Trophy } from 'lucide-vue-next'
import { legacyRedirect, PROGRESSION_DEFAULT } from '#shared/utils/nav'
import { hasPlan, planFollowed, planWeekOk, raceList, runsPerWeek, runsWeekOk, streak, RUNS_PER_WEEK } from '#shared/utils/progress'
import { defaultBilanWeek } from '#shared/utils/bilan'
import { mondayOf } from '#shared/utils/today'

definePageMeta({
  // Ancienne rubrique « Niveau IA » (version 1.15) : rejointe par Forme
  middleware: [(to) => {
    const t = legacyRedirect(to.path, to.query)
    if (t) return navigateTo(t, { replace: true, redirectCode: 301 })
  }],
})

useHead({ title: 'Progression · stravaXgarmin' })

const { sorted } = useActivities()
const { accounts } = useAccounts()
const { active: demo } = useDemo()
const { bests, fromGarmin } = useRecords()
const { shoes } = useFitness()
const { adherence } = usePlan()

const { tab, direction } = useTab(['regularite', 'forme', 'records', 'materiel'] as const, PROGRESSION_DEFAULT as 'regularite')
// Rubriques affichées sur la deuxième face de la barre du bas
useSubnav('progression', 'Rubriques de Progression', [
  { id: 'regularite', label: 'Régularité', icon: 'regularity' },
  { id: 'forme', label: 'Forme', icon: 'forme' },
  { id: 'records', label: 'Records', icon: 'records' },
  { id: 'materiel', label: 'Matériel', icon: 'shoes' },
], tab)

/* ───── Régularité ───── */
const withPlan = computed(() => hasPlan(adherence.value))
const followed = computed(() => planFollowed(adherence.value))
const runWeeks = computed(() => runsPerWeek(sorted.value, TODAY))
const series = computed(() => (withPlan.value ? streak(adherence.value, planWeekOk) : streak(runWeeks.value, runsWeekOk)))
/** Une case par semaine pour la frise de la série : remplie si la semaine compte */
const seriesDots = computed(() =>
  withPlan.value
    ? adherence.value.map((w, i) => ({ from: w.from, ok: planWeekOk(w), current: i === adherence.value.length - 1 }))
    : runWeeks.value.map((w) => ({ from: w.from, ok: runsWeekOk(w), current: w.current })),
)
const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`
const seriesText = computed(() => {
  const what = withPlan.value ? 'sans séance sautée' : `avec au moins ${RUNS_PER_WEEK} courses`
  const n = series.value.weeks
  if (!n) return withPlan.value ? 'Pas de série en cours : la semaine dernière comptait une séance sautée, ou rien de prévu.' : `Pas de série en cours : vise ${RUNS_PER_WEEK} courses cette semaine pour en lancer une.`
  return `${n > 1 ? 'semaines de suite' : 'semaine'} ${what}${series.value.open ? ', et peut-être plus' : ''}`
})
const seriesHint = computed(() => {
  if (!series.value.weeks) return ''
  return series.value.current ? 'Cette semaine compte déjà.' : 'Cette semaine n’est pas encore gagnée : tiens le cap jusqu’à dimanche.'
})
const hasPlanSource = computed(() => accounts.value.garmin.connected || demo.value)

// Carte « Bilan de la semaine » : la semaine que le bilan montre par défaut
const bilanFrom = computed(() => defaultBilanWeek(TODAY, sorted.value.map((a) => a.localDate)))
const bilanRuns = computed(() => {
  const to = new Date(Date.parse(`${bilanFrom.value}T12:00:00Z`) + 6 * 86_400_000).toISOString().slice(0, 10)
  return sorted.value.filter((a) => a.localDate >= bilanFrom.value && a.localDate <= to)
})
const dayMonth = new Intl.DateTimeFormat('fr-BE', { day: 'numeric', month: 'long', timeZone: 'UTC' })
const bilanTitle = computed(() => (bilanFrom.value === mondayOf(TODAY) ? 'Cette semaine' : `Semaine du ${dayMonth.format(new Date(`${bilanFrom.value}T12:00:00Z`))}`))

/* ───── Forme ───── */
const garminForme = computed(() => accounts.value.garmin.connected || demo.value)

/* ───── Records ───── */
const shortDate = new Intl.DateTimeFormat('fr-BE', { day: 'numeric', month: 'short', timeZone: 'Europe/Brussels' })
const longDate = new Intl.DateTimeFormat('fr-BE', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
const races = computed(() => raceList(sorted.value))
</script>

<template>
  <div class="stack stack--wide">
    <AppHeader eyebrow="Régularité, forme et records" title="Progression" />

    <ConnectPrompt v-if="!sorted.length && !accounts.strava.connected && !demo" text="Ta régularité, tes records et ton bilan de la semaine apparaîtront ici une fois Strava connecté." />

    <template v-else>
    <Transition :name="`tab-${direction}`" mode="out-in">
      <!-- ── Régularité ── -->
      <div v-if="tab === 'regularite'" key="regularite" class="panel cols regularity">
        <div class="col">
          <!-- Plan suivi, en grand -->
          <section v-if="withPlan" class="card hero" aria-labelledby="followed-title">
            <p id="followed-title" class="eyebrow"><CalendarCheck :size="13" aria-hidden="true" /> Plan suivi · 8 semaines</p>
            <p class="big">
              <span class="num ink-grad"><CountUp :value="followed.pct ?? 0" :delay="120" /></span><span class="pct">%</span>
            </p>
            <p class="lead hero-lead">
              {{ plural(followed.done, 'séance faite', 'séances faites') }} en entier sur {{ followed.planned }} prévues.
              <template v-if="followed.short || followed.failed"> Avec les séances écourtées ou ratées, tu en as couru {{ followed.done + followed.short + followed.failed }}.</template>
            </p>
            <!-- La même répartition, en une barre -->
            <div class="meter" aria-hidden="true">
              <span v-if="followed.done" class="m m--done" :style="{ flexGrow: followed.done }" />
              <span v-if="followed.short" class="m m--short" :style="{ flexGrow: followed.short }" />
              <span v-if="followed.failed" class="m m--failed" :style="{ flexGrow: followed.failed }" />
              <span v-if="followed.skipped" class="m m--skipped" :style="{ flexGrow: followed.skipped }" />
            </div>
          </section>

          <!-- Sans plan : les courses par semaine, et comment faire apparaître le plan -->
          <section v-else class="card hero" aria-labelledby="noplan-title">
            <p id="noplan-title" class="eyebrow"><CalendarCheck :size="13" aria-hidden="true" /> Régularité · 8 semaines</p>
            <p class="big">
              <span class="num ink-grad"><CountUp :value="runWeeks.reduce((s, w) => s + w.runs, 0)" :delay="120" /></span><span class="pct unit">courses</span>
            </p>
            <p class="lead hero-lead">Ton plan n’est pas encore là, alors on compte tes courses semaine par semaine.</p>
            <NuxtLink :to="hasPlanSource ? '/journal?onglet=a-venir' : '/connexion/garmin'" class="row plan-hint">
              <span class="tile" style="--tile: var(--accent-text)" aria-hidden="true"><CalendarDays :size="20" /></span>
              <span class="row__main">
                <span class="title">{{ hasPlanSource ? 'Fais apparaître ton plan' : 'Connecte Garmin' }}</span>
                <span class="label hint">{{ hasPlanSource ? 'Exporte tes séances Kiprun vers ton calendrier Garmin' : 'Tes séances Kiprun passent par ton calendrier Garmin' }}</span>
              </span>
              <ChevronRight :size="18" aria-hidden="true" />
            </NuxtLink>
          </section>

          <AdherenceChart v-if="withPlan" :weeks="adherence" />
          <RunsWeekChart v-else :weeks="runWeeks" />
        </div>

        <div class="col">
          <!-- Série en cours -->
          <section class="card card--pad streak" aria-labelledby="streak-title">
            <div class="section-head">
              <h2 id="streak-title" class="eyebrow"><Flame :size="13" aria-hidden="true" /> Série en cours</h2>
            </div>
            <div class="streak-main">
              <span v-if="series.weeks" class="num streak-n">{{ series.weeks }}</span>
              <p class="streak-text" :class="{ alone: !series.weeks }">{{ seriesText }}</p>
            </div>
            <ol class="dots" aria-hidden="true">
              <li v-for="d in seriesDots" :key="d.from" class="dot" :class="{ ok: d.ok, now: d.current }" />
            </ol>
            <p v-if="seriesHint" class="fine">{{ seriesHint }}</p>
          </section>

          <LoadChart />

          <!-- Bilan de la semaine -->
          <NuxtLink :to="`/bilan?semaine=${bilanFrom}`" class="card bilan-link">
            <span class="tile" style="--tile: var(--info)" aria-hidden="true"><Sparkles :size="22" /></span>
            <span class="row__main">
              <span class="eyebrow">Bilan de la semaine</span>
              <span class="title">{{ bilanTitle }}</span>
              <span class="hint">{{ bilanRuns.length ? `${formatKm(bilanRuns.reduce((s, a) => s + a.distanceKm, 0))} km · ${plural(bilanRuns.length, 'course', 'courses')} · plan suivi et lecture par l’IA` : 'Chiffres, plan suivi et lecture par l’IA' }}</span>
            </span>
            <ChevronRight class="go" :size="20" aria-hidden="true" />
          </NuxtLink>
        </div>
      </div>

      <!-- ── Forme ── -->
      <div v-else-if="tab === 'forme'" key="forme" class="panel cols">
        <GoalCard class="span-all" />
        <template v-if="garminForme">
          <FormePanel class="span-all" />
        </template>
        <template v-else>
          <NuxtLink to="/connexion/garmin" class="card card--pad lead hint-card span-all">
            Garmin non connecté : estimation par l’IA. Connecte Garmin pour voir ta VO2max, ton statut d’entraînement, ta récupération et tes temps prédits par ta montre.
          </NuxtLink>
          <LevelEstimate class="span-all" />
        </template>
        <!-- En démo (Garmin fictif), le repli reste visible, replié -->
        <details v-if="demo" class="card fallback span-all">
          <summary class="row">
            <span class="tile" style="--tile: var(--accent-text)" aria-hidden="true"><Sparkles :size="20" /></span>
            <span class="row__main">
              <span class="title">Sans Garmin : estimation par l’IA</span>
              <span class="hint">Ce que cette rubrique montre quand Garmin n’est pas connecté</span>
            </span>
            <ChevronRight class="chev" :size="18" aria-hidden="true" />
          </summary>
          <div class="fallback-in">
            <LevelEstimate />
          </div>
        </details>
      </div>

      <!-- ── Records ── -->
      <div v-else-if="tab === 'records'" key="records" class="panel cols">
        <div class="col">
          <div class="section-head">
            <h2 class="h2">Tes records</h2>
            <span v-if="fromGarmin" class="label">via Garmin</span>
          </div>
          <div class="card list">
            <component
              :is="b.activity ? 'NuxtLink' : 'div'"
              v-for="b in bests"
              :key="b.key"
              :to="b.activity ? `/activites/${b.activity.id}` : undefined"
              class="row"
            >
              <span class="tile" :style="{ '--tile': b.time ? 'var(--ok)' : 'var(--muted)' }" aria-hidden="true"><Trophy :size="22" /></span>
              <span class="row__main">
                <span class="title">{{ b.label }}</span>
                <span class="label">{{ b.time ? [b.activity ? displayTitle(b.activity).title : b.name, b.date ? shortDate.format(new Date(b.date)) : ''].filter(Boolean).join(' · ') : 'Pas encore couru' }}</span>
              </span>
              <span class="num pr">{{ b.time ? formatDuration(b.time) : '–' }}</span>
            </component>
          </div>
        </div>
        <div class="col">
          <div class="section-head">
            <h2 class="h2">Compétitions</h2>
            <span v-if="races.length" class="label">{{ plural(races.length, 'course', 'courses') }}</span>
          </div>
          <ol v-if="races.length" class="card list races">
            <li v-for="r in races" :key="r.id">
              <NuxtLink :to="`/activites/${r.id}`" class="row race">
                <span class="tile" style="--tile: var(--type-race)" aria-hidden="true"><Medal :size="22" /></span>
                <span class="row__main">
                  <span class="title">{{ r.title }}</span>
                  <span class="label">{{ longDate.format(new Date(`${r.date}T12:00:00Z`)) }} · {{ formatKm(r.distanceKm) }} km</span>
                </span>
                <span class="race-nums">
                  <span class="num pr">{{ formatDuration(r.durationSec) }}</span>
                  <span class="label">{{ r.pace }} /km</span>
                </span>
              </NuxtLink>
            </li>
          </ol>
          <div v-else class="card card--pad empty">
            <span class="tile" style="--tile: var(--type-race)" aria-hidden="true"><Medal :size="22" /></span>
            <p class="lead">Aucune compétition pour l’instant. Choisis le type « Course » sur Strava, ou commence son titre par « [RACE] » : elle apparaîtra ici avec son temps et son allure.</p>
          </div>
        </div>
      </div>

      <!-- ── Matériel ── -->
      <div v-else key="materiel" class="panel panel--narrow">
        <ShoeList />
        <p v-if="!shoes.length" class="card card--pad lead">
          Aucune paire trouvée dans tes courses. Associe tes chaussures à tes activités dans Strava : leur kilométrage et leur usure s’afficheront ici.
        </p>
      </div>
    </Transition>
    </template>
  </div>
</template>

<style scoped>
.hint {
  font-size: 14px;
  color: var(--muted);
}

/* ── Plan suivi ── */
.hero {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 22px 20px 20px;
  overflow: hidden;
}

/* Halo discret derrière le grand chiffre */
.hero::after {
  content: '';
  position: absolute;
  top: -40%;
  right: -20%;
  width: 70%;
  aspect-ratio: 1;
  background: var(--glow-a);
  opacity: 0.22;
  pointer-events: none;
}

.hero .eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.big {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: baseline;
  gap: 4px;
  margin: 2px 0 0;
  line-height: 0.95;
}

.big .num {
  font-size: 88px;
  letter-spacing: var(--tracking-display);
}

.pct {
  font-family: var(--font-display);
  font-weight: var(--display-weight);
  font-size: 34px;
  color: var(--ink-2);
}

.pct.unit {
  font-size: 22px;
  margin-left: 6px;
}

.hero-lead {
  position: relative;
  z-index: 1;
  margin: 6px 0 4px;
  font-size: 15px;
  max-width: 44ch;
}

.meter {
  position: relative;
  z-index: 1;
  display: flex;
  gap: 2px;
  height: 10px;
  margin-top: 8px;
  border-radius: var(--r-pill);
  overflow: hidden;
  transform-origin: left;
  animation: grow-x 0.9s var(--ease-spring) 0.25s backwards;
}

@keyframes grow-x {
  from {
    transform: scaleX(0);
  }
}

.m {
  flex-basis: 0;
}

.m--done {
  background: var(--ok);
}

.m--short {
  background: repeating-linear-gradient(135deg, var(--accent-text) 0 3px, color-mix(in srgb, var(--accent-text) 45%, transparent) 3px 6px);
}

.m--failed {
  background: var(--ko);
}

.m--skipped {
  background: repeating-linear-gradient(45deg, color-mix(in srgb, var(--muted) 55%, transparent) 0 1px, transparent 1px 5px);
  box-shadow: inset 0 0 0 1.5px var(--muted);
}

.plan-hint {
  position: relative;
  z-index: 1;
  margin-top: 8px;
  padding: 12px;
  min-height: 0;
  border-radius: var(--r-ctrl);
  background: var(--surface-2);
}

/* ── Série ── */
.streak {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.streak .eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.streak-main {
  display: flex;
  align-items: center;
  gap: 14px;
}

.streak-n {
  font-size: 56px;
  line-height: 1;
  letter-spacing: var(--tracking-display);
}

.streak-text {
  margin: 0;
  font-weight: 700;
  font-size: 17px;
  line-height: 1.3;
  color: var(--ink);
}

.streak-text.alone {
  font-weight: 600;
  font-size: 15px;
  color: var(--ink-2);
}

.dots {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.dot {
  height: 8px;
  border-radius: var(--r-pill);
  background: var(--line-strong);
  animation: rise 0.4s var(--ease-out) backwards;
}

.dot.ok {
  background: var(--primary);
}

.dot.now:not(.ok) {
  background: transparent;
  box-shadow: inset 0 0 0 1.5px var(--line-strong);
}

/* ── Bilan ── */
.bilan-link {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px;
}

.bilan-link .row__main {
  gap: 3px;
}

.bilan-link .eyebrow {
  color: var(--accent-text);
}

.go {
  flex-shrink: 0;
  color: var(--muted);
}

/* ── Forme ── */
.hint-card {
  display: block;
  max-width: none;
  font-size: 15px;
}

.fallback summary {
  min-height: 72px;
  list-style: none;
  cursor: pointer;
}

.fallback .title {
  white-space: normal;
}

.fallback summary::-webkit-details-marker {
  display: none;
}

.chev {
  flex-shrink: 0;
  color: var(--muted);
  transition: transform 0.25s var(--ease-out);
}

.fallback[open] .chev {
  transform: rotate(90deg);
}

.fallback-in {
  padding: 4px 16px 18px;
}

/* ── Records ── */
.pr {
  font-size: 20px;
}

.races {
  margin: 0;
  padding: 0;
  list-style: none;
}

.race-nums {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  flex-shrink: 0;
}

.empty {
  display: flex;
  align-items: flex-start;
  gap: 14px;
}

.empty .lead {
  margin: 0;
  font-size: 15px;
}
</style>
