<script setup lang="ts">
/*
 * Bilan : la semaine choisie (ou le mois en cours) en un écran. Les chiffres comparés à la période d'avant,
 * le plan suivi de la semaine (séances et issues), les records, la lecture par l'IA (WeekReview) et l'image
 * à partager. Réunit l'ancien « Récap » et l'ancien « Bilan IA ». Adresse : /bilan?semaine=AAAA-MM-JJ, /bilan?p=mois.
 * Règles : shared/utils/bilan.ts (semaine par défaut, plan suivi, ce qui part chez l'IA).
 */
import { ChevronLeft, ChevronRight, Circle, CircleCheck, CircleDot, CircleX, CircleMinus, Share2, Trophy, TrendingUp, TrendingDown, X } from 'lucide-vue-next'
import type { RecapKind } from '~/composables/useRecap'
import { BILAN_WEEKS_BACK, defaultBilanWeek, pickBilanWeek, weekPlan, type WeekSessionStatus } from '#shared/utils/bilan'
import { mondayOf } from '#shared/utils/today'

useHead({ title: 'Bilan · stravaXgarmin' })

const route = useRoute()
const router = useRouter()
const { sorted } = useActivities()
const { accounts } = useAccounts()
const { active: demo } = useDemo()
const { list: plan, linked, outcomes } = usePlan()
const { show } = useToast()

/* ───── Période ───── */
const kind = computed<RecapKind>({
  get: () => (route.query.p === 'mois' ? 'mois' : 'semaine'),
  set: (k) => router.replace({ query: { ...route.query, p: k === 'mois' ? 'mois' : undefined } }),
})
const DAY = 86_400_000
const shift = (d: string, n: number) => new Date(Date.parse(`${d}T12:00:00Z`) + n * DAY).toISOString().slice(0, 10)
const thisMonday = mondayOf(TODAY)
const oldest = shift(thisMonday, -7 * BILAN_WEEKS_BACK)
const week = computed(() => pickBilanWeek(route.query.semaine, TODAY) ?? defaultBilanWeek(TODAY, sorted.value.map((a) => a.localDate)))
function goWeek(n: number) {
  const next = shift(week.value, n * 7)
  if (next < oldest || next > thisMonday) return
  router.replace({ query: { ...route.query, semaine: next } })
}
const weekName = computed(() => {
  if (week.value === thisMonday) return 'Cette semaine'
  if (week.value === shift(thisMonday, -7)) return 'La semaine dernière'
  return null
})

const recap = useRecap(kind, week)

/* ───── Plan suivi de la semaine ───── */
const wplan = computed(() => (kind.value === 'semaine' ? weekPlan(plan.value.filter((s) => !s.synthetic), linked.value, outcomes.value, week.value, TODAY) : null))
const STATUS: Record<WeekSessionStatus, { word: string; icon: unknown; color: string }> = {
  done: { word: 'Faite', icon: CircleCheck, color: 'var(--ok)' },
  short: { word: 'Écourtée', icon: CircleMinus, color: 'var(--accent-text)' },
  failed: { word: 'Ratée', icon: CircleX, color: 'var(--ko)' },
  skipped: { word: 'Sautée', icon: X, color: 'var(--muted)' },
  today: { word: 'Aujourd’hui', icon: CircleDot, color: 'var(--info)' },
  upcoming: { word: 'À venir', icon: Circle, color: 'var(--muted)' },
}
const dayFmt = new Intl.DateTimeFormat('fr-BE', { weekday: 'short', day: 'numeric', timeZone: 'UTC' })
const planLine = computed(() => {
  const p = wplan.value
  if (!p) return ''
  const bits = [p.short && `${p.short} écourtée${p.short > 1 ? 's' : ''}`, p.failed && `${p.failed} ratée${p.failed > 1 ? 's' : ''}`, p.skipped && `${p.skipped} sautée${p.skipped > 1 ? 's' : ''}`, p.ahead && `${p.ahead} encore à venir`].filter(Boolean)
  return bits.join(' · ')
})

/* ───── Chiffres ───── */
const maxBar = computed(() => Math.max(...recap.value.bars.map((b) => b.km), 1))
const deltaText = computed(() => {
  const d = recap.value.deltaPct
  if (d === null) return null
  return `${d > 0 ? '+' : ''}${d} % par rapport à ${recap.value.compareLabel}`
})

/* ───── Image à partager ───── */
const sharing = ref(false)
async function share() {
  sharing.value = true
  try {
    const r = recap.value
    const p = wplan.value
    const blob = await renderRecapImage({
      period: r.title,
      km: formatKm(r.km),
      delta: r.deltaPct === null ? null : `${r.deltaPct > 0 ? '+' : ''}${r.deltaPct} %`,
      stats: [
        { label: 'courses', value: String(r.count) },
        { label: 'temps', value: formatHours(r.sec) },
        p?.planned ? { label: 'plan suivi', value: `${p.done}/${p.planned}` } : { label: 'allure /km', value: r.pace },
        { label: 'dénivelé', value: `${r.elevation} m` },
      ],
      bars: r.bars.map((b) => ({ label: b.label, km: b.km })),
      highlight: r.records[0]
        ? `Record sur ${r.records[0].label} : ${formatDuration(r.records[0].time)}`
        : r.longest
          ? `Plus longue sortie : ${formatKm(r.longest.distanceKm)} km`
          : undefined,
    })
    const how = await shareOrDownload(blob, `bilan-${kind.value === 'mois' ? 'mois' : r.from}.png`, `Mon bilan · ${r.title}`)
    if (how === 'downloaded') show('Image du bilan téléchargée')
  } catch (e) {
    if ((e as Error).name !== 'AbortError') show('Impossible de créer l’image, réessaie dans un instant')
  } finally {
    sharing.value = false
  }
}
</script>

<template>
  <div class="stack stack--wide bilan">
    <BackLink to="/progression" label="Progression" />
    <div class="title-block">
      <p class="eyebrow">{{ kind === 'mois' ? 'Ton mois' : 'Ta semaine' }}</p>
      <h1 class="h1 h1--xl">Bilan</h1>
    </div>

    <ConnectPrompt v-if="!sorted.length && !accounts.strava.connected && !demo" text="Ton bilan de la semaine et du mois apparaîtra ici une fois Strava connecté." />

    <template v-else>
    <div class="controls">
      <div class="segmented period" role="group" aria-label="Période du bilan">
        <button type="button" :aria-pressed="kind === 'semaine'" @click="kind = 'semaine'">Semaine</button>
        <button type="button" :aria-pressed="kind === 'mois'" @click="kind = 'mois'">Mois</button>
      </div>
      <div v-if="kind === 'semaine'" class="picker card" role="group" aria-label="Semaine du bilan">
        <button type="button" class="nav" :disabled="week <= oldest" aria-label="Semaine précédente" @click="goWeek(-1)"><ChevronLeft :size="20" aria-hidden="true" /></button>
        <span class="which" aria-live="polite">
          <span class="title">{{ weekName ?? recap.title }}</span>
          <span v-if="weekName" class="label">{{ recap.title }}</span>
        </span>
        <button type="button" class="nav" :disabled="week >= thisMonday" aria-label="Semaine suivante" @click="goWeek(1)"><ChevronRight :size="20" aria-hidden="true" /></button>
      </div>
    </div>

    <!-- La clé relance l'apparition à chaque changement de période -->
    <div :key="kind === 'mois' ? 'mois' : week" class="stack stack--wide grid" :class="{ 'has-plan': wplan && wplan.sessions.length }">
      <section class="block block--primary hero">
        <p class="label">{{ recap.title }}</p>
        <p class="num big"><CountUp :value="recap.km" :decimals="1" :delay="80" /> km</p>
        <p v-if="deltaText" class="delta">
          <component :is="(recap.deltaPct ?? 0) >= 0 ? TrendingUp : TrendingDown" :size="18" aria-hidden="true" />
          {{ deltaText }}
        </p>
        <p v-else-if="!recap.count" class="delta">Aucune course sur cette période.</p>
      </section>

      <dl class="grid-2 stats">
        <div class="card stat"><dt class="label">courses</dt><dd class="num">{{ recap.count }}</dd></div>
        <div class="card stat"><dt class="label">temps</dt><dd class="num">{{ formatHours(recap.sec) }}</dd></div>
        <div class="card stat"><dt class="label">allure /km</dt><dd class="num">{{ recap.pace }}</dd></div>
        <div class="card stat"><dt class="label">dénivelé</dt><dd class="num">{{ recap.elevation }} m</dd></div>
      </dl>

      <section class="card card--pad chart" :aria-label="kind === 'mois' ? 'Kilomètres par semaine du mois' : 'Kilomètres par jour'">
        <ol class="bars">
          <li v-for="(b, i) in recap.bars" :key="b.label + i" :style="{ '--b': i }" :aria-label="`${b.label} : ${formatKm(b.km)} km`">
            <span class="value label" aria-hidden="true">{{ b.km ? formatKm(b.km) : '' }}</span>
            <span class="zone" aria-hidden="true">
              <span class="bar" :class="{ off: !b.km, future: b.future }" :style="{ height: `${b.km ? Math.max((b.km / maxBar) * 100, 10) : 6}%` }" />
            </span>
            <span class="label" aria-hidden="true">{{ b.label }}</span>
          </li>
        </ol>
      </section>

      <!-- Plan suivi de la semaine -->
      <section v-if="wplan && wplan.sessions.length" class="card plan" aria-labelledby="plan-title">
        <header class="plan-head">
          <div>
            <h2 id="plan-title" class="eyebrow">Plan suivi</h2>
            <p class="plan-score"><span class="num">{{ wplan.done }}</span><span class="of">sur {{ wplan.planned }} {{ wplan.planned > 1 ? 'séances faites' : 'séance faite' }}</span></p>
            <p v-if="planLine" class="label">{{ planLine }}</p>
          </div>
          <span class="pips" aria-hidden="true">
            <span v-for="s in wplan.sessions" :key="s.id" class="pip" :class="`pip--${s.status}`" />
          </span>
        </header>
        <ol class="list sessions">
          <li v-for="s in wplan.sessions" :key="s.id">
            <component :is="s.runId ? 'NuxtLink' : 'div'" :to="s.runId ? `/activites/${s.runId}` : undefined" class="row srow" :class="`is-${s.status}`">
              <span class="day label">{{ dayFmt.format(new Date(`${s.date}T12:00:00Z`)) }}</span>
              <span class="row__main"><span class="title">{{ s.title }}</span></span>
              <span class="status" :style="{ '--s': STATUS[s.status].color }">
                <component :is="STATUS[s.status].icon" :size="15" aria-hidden="true" />
                {{ STATUS[s.status].word }}
              </span>
            </component>
          </li>
        </ol>
      </section>

      <div v-if="recap.records.length || recap.longest" class="card list highlights">
        <NuxtLink v-for="r in recap.records" :key="r.key + r.activity.id" :to="`/activites/${r.activity.id}`" class="row">
          <span class="tile" style="--tile: var(--ok)" aria-hidden="true"><Trophy :size="22" /></span>
          <span class="row__main">
            <span class="title">Record sur {{ r.label }} : {{ formatDuration(r.time) }}</span>
            <span class="label">{{ displayTitle(r.activity).title }}</span>
          </span>
        </NuxtLink>
        <NuxtLink v-if="recap.longest" :to="`/activites/${recap.longest.id}`" class="row">
          <ActivityTile :type="recap.longest.type" :activity="recap.longest" />
          <span class="row__main">
            <span class="title">Plus longue sortie : {{ formatKm(recap.longest.distanceKm) }} km</span>
            <span class="label">{{ displayTitle(recap.longest).title }}</span>
          </span>
        </NuxtLink>
      </div>

      <WeekReview v-if="kind === 'semaine'" class="span-all" :from="week" :plan="wplan" />

      <button type="button" class="btn btn--primary share" :disabled="sharing || !recap.count" @click="share">
        {{ sharing ? 'Création de l’image…' : 'Partager mon bilan' }}
        <Share2 :size="20" aria-hidden="true" />
      </button>
    </div>
    </template>
  </div>
</template>

<style scoped>
.title-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.controls {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.picker {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px;
}

.nav {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  border: 0;
  border-radius: var(--r-ctrl);
  background: transparent;
  color: var(--ink);
  cursor: pointer;
  transition: background-color 0.15s ease, transform 0.12s ease;
}

.nav:not(:disabled):active {
  transform: scale(0.92);
  background: var(--line);
}

.nav:disabled {
  color: var(--line-strong);
  cursor: default;
}

.which {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

@media (min-width: 720px) {
  .controls {
    flex-direction: row;
    align-items: stretch;
  }

  .period {
    width: 260px;
  }

  .picker {
    width: 380px;
  }

  /* Deux colonnes : à gauche les kilomètres, à droite les chiffres et le plan suivi */
  .grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    grid-template-areas:
      'hero stats'
      'chart highlights';
    align-items: start;
    gap: 20px;
  }

  .grid.has-plan {
    grid-template-areas:
      'hero stats'
      'chart plan'
      'highlights plan';
  }

  .grid > .hero { grid-area: hero; align-self: stretch; }
  .grid > .stats { grid-area: stats; }
  .grid > .chart { grid-area: chart; }
  .grid > .plan { grid-area: plan; }
  .grid > .highlights { grid-area: highlights; }

  .grid > .span-all,
  .grid > .share {
    grid-column: 1 / -1;
  }

  .grid > .share {
    justify-self: start;
    width: auto;
    min-width: 280px;
  }
}

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
  border-radius: calc(var(--r-ctrl) / 2 + 2px) calc(var(--r-ctrl) / 2 + 2px) 2px 2px;
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

/* ── Plan suivi ── */
.plan {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.plan-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 18px 14px;
}

.plan-head .eyebrow {
  margin: 0;
}

.plan-score {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin: 6px 0 2px;
}

.plan-score .num {
  font-size: 40px;
  line-height: 1;
}

.of {
  font-weight: 700;
  color: var(--ink-2);
}

.pips {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 4px;
  max-width: 110px;
  padding-top: 4px;
}

.pip {
  width: 12px;
  height: 12px;
  border-radius: var(--r-pill);
  background: var(--line-strong);
}

.pip--done {
  background: var(--ok);
}

.pip--short {
  background: repeating-linear-gradient(135deg, var(--accent-text) 0 2px, color-mix(in srgb, var(--accent-text) 40%, transparent) 2px 4px);
}

.pip--failed {
  background: var(--ko);
}

.pip--skipped {
  background: transparent;
  box-shadow: inset 0 0 0 1.5px var(--muted);
}

.pip--today,
.pip--upcoming {
  background: transparent;
  box-shadow: inset 0 0 0 1.5px var(--line-strong);
}

.sessions {
  margin: 0;
  padding: 0;
  list-style: none;
  border-top: 1px solid var(--line);
}

.srow {
  min-height: 52px;
  padding-block: 10px;
}

.day {
  flex-shrink: 0;
  width: 64px;
  white-space: nowrap;
  text-transform: capitalize;
}

.is-skipped .title,
.is-upcoming .title {
  color: var(--muted);
}

.is-skipped .title {
  text-decoration: line-through;
  text-decoration-color: var(--line-strong);
}

.status {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  flex-shrink: 0;
  font-size: 13px;
  font-weight: 700;
  color: var(--s);
}
</style>
