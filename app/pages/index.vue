<script setup lang="ts">
/*
 * Aujourd'hui : « qu'est-ce que j'ai à faire maintenant ? ». Une seule carte principale (course à débriefer,
 * séance du jour, prochaine séance ou dernière course : pickFocus), puis « Ta semaine » (weekView), puis le
 * reste plus calme (alertes, cartes secondaires, objectif). Règles : shared/utils/today.ts.
 */
import { ArrowRight, ChevronRight, CircleAlert, ClipboardCheck, CalendarClock, Flag, Footprints, Heart, TrendingUp, Activity as Pulse } from 'lucide-vue-next'
import { daysBetween, pickFocus, todayAlerts, weekView, type Alert, type Focus } from '#shared/utils/today'

useHead({ title: 'Aujourd’hui · stravaXgarmin' })

const { sorted, byId } = useActivities()
const { toDebrief } = useDebriefs()
const { accounts } = useAccounts()
const { active: demo } = useDemo()
const { synced } = useSync()
const { firstName, masked } = useRunner()
const { list: plan, done, resultFor, byId: sessionById } = usePlan()
const { ramp, shoes, goalInfo } = useFitness()
const { summary: health } = useHealth()
const hasData = computed(() => sorted.value.length > 0)

/*
 * Sans compte ni démo, la présentation s'affiche directement ici plutôt que par une
 * redirection : sur iPhone, une app installée dont la page de départ redirige
 * s'ouvre avec la barre du navigateur.
 */
const showLanding = computed(() => !accounts.value.strava.connected && !demo.value && !hasData.value)
// Le layout initial est choisi par le middleware ; ici on suit les changements (démo, connexion)
watch(showLanding, (v) => setPageLayout(v ? 'bare' : 'default'))

/* ───── Ce qu'il y a à faire ───── */

const sessions = computed(() => plan.value.filter((s) => !s.synthetic))
const focus = computed(() =>
  pickFocus({
    toDebrief: toDebrief.value.map((a) => a.id),
    sessions: sessions.value,
    done: done.value,
    lastRun: sorted.value[0]?.id ?? null,
    today: TODAY,
  }),
)
const week = computed(() => weekView({ today: TODAY, runs: sorted.value, sessions: sessions.value, done: done.value }))

/* Alertes : elles dépendent de l'état gardé (lectures, chaussures) : seulement une fois la page montée */
const mounted = ref(false)
onMounted(() => (mounted.value = true))
const alerts = computed<Alert[]>(() => {
  if (!mounted.value) return []
  const g = goalInfo.value
  return todayAlerts({
    core: health.value.core,
    ramp: ramp.value,
    shoes: shoes.value,
    goal: g ? { name: g.name, days: g.days, past: g.past, label: GOAL_DISTANCES.find((x) => x.id === g.distance)?.label ?? '' } : null,
  })
})
const ALERT_ICON = { health: CircleAlert, load: TrendingUp, shoes: Footprints, goal: Flag }
const ALERT_TONE = { health: 'var(--ko)', load: 'var(--ko)', shoes: 'var(--accent-text)', goal: 'var(--info)' }

/* ───── Mots ───── */

const longDay = new Intl.DateTimeFormat('fr-BE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Brussels' })
/** « Aujourd’hui », « Hier », « Mardi 17 novembre » pour une course */
function runDay(a: { localDate: string; startedAt: string }) {
  const d = daysBetween(a.localDate, TODAY)
  if (d === 0) return 'Aujourd’hui'
  if (d === 1) return 'Hier'
  const s = longDay.format(new Date(a.startedAt))
  return s.charAt(0).toUpperCase() + s.slice(1)
}
const runOf = (f: Focus) => ('runId' in f ? byId(f.runId) : undefined)
const sessionOf = (f: Focus) => ('sessionId' in f ? sessionById(f.sessionId) : undefined)

const main = computed(() => focus.value.main)
const mainRun = computed(() => runOf(main.value))
const mainSession = computed(() => sessionOf(main.value))
/** Résultat proposé pour la course à débriefer (« 5 efforts sur 8 ») */
const proposal = computed(() => (main.value.kind === 'debrief' && mainRun.value ? resultFor(mainRun.value) : null))
const reps = computed(() => {
  const p = proposal.value
  return p?.basis === 'reps' && p.plannedReps && p.plannedReps <= 24 ? { done: p.doneReps ?? 0, planned: p.plannedReps } : null
})
const secondary = computed(() => focus.value.secondary)
</script>

<template>
  <LandingPage v-if="showLanding" />
  <div v-else class="stack stack--wide home">
    <AppHeader :eyebrow="formatDay(`${TODAY}T12:00:00+01:00`)" :fit="`Salut ${firstName}`">
      Salut<template v-if="firstName">{{ ' ' }}<span class="ink-grad" :class="{ masked }" :aria-label="masked ? 'nom masqué' : undefined">{{ firstName }}</span></template>
    </AppHeader>

    <div class="col-main">
      <!-- ── La carte principale ── -->
      <section v-if="main.kind === 'debrief' && mainRun" class="block block--primary focus" aria-labelledby="focus-title">
        <div class="kicker">
          <span class="badge"><ClipboardCheck :size="14" aria-hidden="true" /> À débriefer</span>
          <span class="when">{{ runDay(mainRun) }}<template v-if="mainRun.indoor"> · {{ placeLabel(mainRun) }}</template></span>
        </div>
        <div class="focus-run">
          <span class="plate thumb" :style="{ '--c': RUN_TYPES[mainRun.type].color }">
            <RunThumb :activity="mainRun" :width="2.4" draw />
          </span>
          <div class="focus-text">
            <h2 id="focus-title" class="focus-title">{{ displayTitle(mainRun).title }}</h2>
            <p class="focus-meta">
              <span class="num">{{ formatKm(mainRun.distanceKm) }}</span> km
              <span class="sep" aria-hidden="true" />
              <span class="num">{{ formatPace(mainRun.durationSec, mainRun.distanceKm) }}</span> /km
            </p>
          </div>
        </div>
        <div v-if="proposal" class="proposal">
          <span v-if="reps" class="reps" aria-hidden="true">
            <span v-for="k in reps.planned" :key="k" class="rep" :class="{ on: k <= reps.done }" :style="{ '--k': k }" />
          </span>
          <span class="proposal-text">Résultat proposé : <strong>{{ proposal.summary }}</strong></span>
        </div>
        <div class="actions">
          <NuxtLink :to="`/activites/${mainRun.id}/debrief`" class="cta">
            Débriefer <span class="cta-ic" aria-hidden="true"><ArrowRight :size="18" /></span>
          </NuxtLink>
          <NuxtLink v-if="main.kind === 'debrief' && main.more" to="/journal?onglet=a-debriefer" class="more">
            et {{ main.more }} autre{{ main.more > 1 ? 's' : '' }}
          </NuxtLink>
        </div>
      </section>

      <section v-else-if="(main.kind === 'today' || main.kind === 'next') && mainSession" class="block block--primary focus" aria-labelledby="focus-title">
        <div class="kicker">
          <span class="badge"><CalendarClock :size="14" aria-hidden="true" /> {{ main.kind === 'today' ? 'Aujourd’hui' : planDay(mainSession.date) }}</span>
          <span v-if="mainSession.provider" class="when">{{ mainSession.provider }}</span>
        </div>
        <h2 id="focus-title" class="focus-title">{{ mainSession.title }}</h2>
        <div v-if="mainSession.blocks.length" class="plate profile-plate">
          <WorkoutProfile :blocks="mainSession.blocks" :height="64" />
        </div>
        <p class="focus-meta">
          <template v-if="mainSession.durationSec"><span class="num">{{ formatHours(mainSession.durationSec) }}</span> environ</template>
          <template v-if="mainSession.durationSec && mainSession.distanceM"><span class="sep" aria-hidden="true" /></template>
          <template v-if="mainSession.distanceM"><span class="num">{{ formatKm(mainSession.distanceM / 1000) }}</span> km</template>
        </p>
        <p v-if="mainSession.description" class="focus-note">{{ mainSession.description }}</p>
        <div class="actions">
          <NuxtLink to="/journal?onglet=a-venir" class="cta">
            Voir la séance <span class="cta-ic" aria-hidden="true"><ArrowRight :size="18" /></span>
          </NuxtLink>
        </div>
      </section>

      <section v-else-if="main.kind === 'last' && mainRun" class="block block--primary focus" aria-labelledby="focus-title">
        <div class="kicker">
          <span class="badge"><Pulse :size="14" aria-hidden="true" /> Dernière course</span>
          <span class="when">{{ runDay(mainRun) }}<template v-if="mainRun.indoor"> · {{ placeLabel(mainRun) }}</template></span>
        </div>
        <div class="focus-run">
          <span class="plate thumb" :style="{ '--c': RUN_TYPES[mainRun.type].color }">
            <RunThumb :activity="mainRun" :width="2.4" draw />
          </span>
          <div class="focus-text">
            <h2 id="focus-title" class="focus-title">{{ displayTitle(mainRun).title }}</h2>
            <dl class="focus-stats">
              <div><dd class="num">{{ formatKm(mainRun.distanceKm) }}</dd><dt>km</dt></div>
              <div><dd class="num">{{ formatPace(mainRun.durationSec, mainRun.distanceKm) }}</dd><dt>/km</dt></div>
              <div v-if="mainRun.avgHr"><dd class="num">{{ mainRun.avgHr }}</dd><dt><Heart :size="10" fill="currentColor" aria-hidden="true" /> bpm</dt></div>
            </dl>
          </div>
        </div>
        <div class="actions">
          <NuxtLink :to="`/activites/${mainRun.id}`" class="cta">
            Voir la course <span class="cta-ic" aria-hidden="true"><ArrowRight :size="18" /></span>
          </NuxtLink>
        </div>
      </section>

      <section v-else-if="accounts.strava.connected && !synced" class="card card--pad loading" aria-busy="true">
        <span class="spinner" aria-hidden="true" />
        <p class="lead">Chargement de tes courses Strava…</p>
      </section>

      <section v-else class="card card--pad empty">
        <span class="tile" style="--tile: var(--accent-text)" aria-hidden="true"><Footprints :size="22" /></span>
        <h2 class="h2">Aucune course sur les 60 derniers jours</h2>
        <p class="lead">Dès qu’une course arrive sur Strava, elle apparaîtra ici.</p>
      </section>

      <!-- ── Ta semaine ── -->
      <WeekStrip v-if="hasData || sessions.length" :week="week" />
    </div>

    <div class="col-side">
      <!-- ── Alertes ── -->
      <ul v-if="alerts.length" class="alerts" aria-label="À surveiller">
        <li v-for="(a, i) in alerts" :key="a.kind + i">
          <NuxtLink :to="a.to" class="alert" :style="{ '--tone': ALERT_TONE[a.kind] }">
            <component :is="ALERT_ICON[a.kind]" :size="15" aria-hidden="true" />
            {{ a.text }}
          </NuxtLink>
        </li>
      </ul>

      <!-- ── Ce qui n'a pas été choisi pour la carte principale ── -->
      <template v-for="f in secondary" :key="f.kind">
        <SessionCard
          v-if="(f.kind === 'today' || f.kind === 'next') && sessionOf(f)"
          :session="sessionOf(f)!"
          :kicker="f.kind === 'today' ? 'Séance du jour' : undefined"
          class="secondary"
        />
        <NuxtLink v-else-if="f.kind === 'last' && runOf(f)" :to="`/activites/${runOf(f)!.id}`" class="card last secondary" :style="{ '--c': RUN_TYPES[runOf(f)!.type].color }">
          <span class="last-thumb"><RunThumb :activity="runOf(f)!" /></span>
          <span class="row__main">
            <span class="eyebrow">Dernière course · {{ runDay(runOf(f)!) }}</span>
            <span class="title last-title">{{ displayTitle(runOf(f)!).title }}</span>
            <span class="last-meta">
              <span class="num">{{ formatKm(runOf(f)!.distanceKm) }}</span> km
              <span class="num">{{ formatPace(runOf(f)!.durationSec, runOf(f)!.distanceKm) }}</span> /km
              <template v-if="runOf(f)!.avgHr"><span class="num">{{ runOf(f)!.avgHr }}</span> bpm</template>
            </span>
          </span>
          <ChevronRight class="go" :size="18" aria-hidden="true" />
        </NuxtLink>
      </template>

      <!-- ── Objectif ── -->
      <GoalCard v-if="goalInfo && !goalInfo.past" compact class="goal-card" />
      <NuxtLink v-else to="/objectif" class="set-goal">
        <Flag :size="16" aria-hidden="true" /> Fixer un objectif course <ChevronRight :size="16" aria-hidden="true" />
      </NuxtLink>

      <NuxtLink v-if="hasData" to="/journal" class="link all">Ton journal <ChevronRight :size="16" aria-hidden="true" /></NuxtLink>
    </div>
  </div>
</template>

<style scoped>
.home {
  gap: 18px;
}

.masked {
  filter: blur(7px);
  user-select: none;
}

/* ───── Carte principale ───── */
.focus {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px 20px 18px;
  border-radius: calc(var(--r-card) + 4px);
}

.focus > * {
  position: relative;
  z-index: 1;
}

/* Halo qui respire lentement derrière la carte : elle est vivante */
.focus::before {
  content: '';
  position: absolute;
  inset: -40% -30% auto auto;
  width: 70%;
  aspect-ratio: 1;
  border-radius: 50%;
  background: radial-gradient(circle, color-mix(in srgb, var(--on-primary) 26%, transparent), transparent 65%);
  animation: halo 7s ease-in-out infinite alternate;
  pointer-events: none;
}

@keyframes halo {
  to {
    transform: translate(-18%, 22%) scale(1.15);
    opacity: 0.6;
  }
}

.kicker {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px 5px 8px;
  border-radius: var(--r-pill);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  background: color-mix(in srgb, currentColor 18%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, currentColor 30%, transparent);
}

.when {
  font-size: 13px;
  font-weight: 700;
  opacity: 0.85;
}

.focus-run {
  display: grid;
  grid-template-columns: 96px minmax(0, 1fr);
  gap: 16px;
  align-items: center;
}

/* Plaque sombre (claire en Papier) sous les dessins : leurs couleurs restent lisibles sur le dégradé */
.plate {
  border-radius: var(--r-ctrl);
  background: color-mix(in srgb, var(--bg) 72%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, currentColor 22%, transparent), 0 10px 24px -12px color-mix(in srgb, var(--bg) 80%, transparent);
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
}

.thumb {
  display: block;
  aspect-ratio: 1;
  padding: 14px 12px;
}

.profile-plate {
  padding: 12px 12px 10px;
}

.focus-text {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.focus-title {
  margin: 0;
  font-family: var(--font-display);
  font-weight: var(--display-weight);
  font-size: 26px;
  line-height: 1.08;
  letter-spacing: var(--tracking-display);
  overflow-wrap: anywhere;
}

.focus-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px;
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  opacity: 0.92;
}

.focus-meta .num {
  font-size: 18px;
}

.sep {
  width: 4px;
  height: 4px;
  margin: 0 6px;
  border-radius: 50%;
  background: currentColor;
  opacity: 0.55;
  align-self: center;
}

.focus-note {
  margin: -4px 0 0;
  font-size: 14px;
  opacity: 0.85;
}

.focus-stats {
  display: flex;
  gap: 16px;
  margin: 0;
}

.focus-stats div {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.focus-stats dd {
  margin: 0;
  font-size: 22px;
}

.focus-stats dt {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  opacity: 0.8;
}

/* Résultat proposé : un segment par effort prévu, pleins pour ceux faits */
.proposal {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 14px;
  border-radius: var(--r-ctrl);
  background: color-mix(in srgb, currentColor 12%, transparent);
}

.reps {
  display: flex;
  gap: 4px;
}

.rep {
  flex: 1;
  height: 8px;
  border-radius: var(--r-pill);
  box-shadow: inset 0 0 0 1.5px color-mix(in srgb, currentColor 55%, transparent);
  animation: pop 0.45s var(--ease-spring) backwards;
  animation-delay: calc(300ms + var(--k) * 45ms);
}

.rep.on {
  background: currentColor;
  box-shadow: 0 0 10px color-mix(in srgb, currentColor 45%, transparent);
}

.proposal-text {
  font-size: 14px;
}

.actions {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

/* Bouton sur le bloc de couleur : verre dépoli, flèche dans une pastille */
.cta {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  min-height: 52px;
  padding: 0 8px 0 20px;
  border-radius: var(--r-btn);
  font-size: 16px;
  font-weight: 800;
  background: color-mix(in srgb, currentColor 18%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, currentColor 40%, transparent), inset 0 1px 0 color-mix(in srgb, currentColor 30%, transparent);
  -webkit-backdrop-filter: blur(10px);
  backdrop-filter: blur(10px);
  transition: transform 0.12s ease, background 0.2s ease;
}

.cta:hover {
  background: color-mix(in srgb, currentColor 26%, transparent);
}

.cta:active {
  transform: scale(0.97);
}

.cta-ic {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: max(calc(var(--r-btn) - 6px), 2px);
  background: currentColor;
}

.cta-ic svg {
  color: var(--primary-solid);
  transition: transform 0.2s var(--ease-out);
}

.cta:hover .cta-ic svg {
  transform: translateX(2px);
}

.more {
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  font-weight: 700;
  font-size: 15px;
  text-decoration: underline;
  text-underline-offset: 4px;
  text-decoration-thickness: 1.5px;
}

/* ───── États d'attente ───── */
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

.empty {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* ───── Alertes ───── */
.alerts {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.alert {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: 40px;
  padding: 0 14px 0 12px;
  border-radius: var(--r-pill);
  font-size: 14px;
  font-weight: 700;
  color: var(--ink);
  background: color-mix(in srgb, var(--tone) 14%, var(--surface-2));
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--tone) 40%, transparent);
}

.alert svg {
  color: var(--tone);
}

/* ───── Cartes secondaires ───── */
.last {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
}

.last-thumb {
  flex-shrink: 0;
  width: 64px;
  height: 64px;
  padding: 10px 9px;
  border-radius: var(--r-ctrl);
  background:
    radial-gradient(circle at 30% 20%, color-mix(in srgb, var(--c) 22%, transparent), transparent 70%),
    var(--surface-2);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--c) 25%, transparent);
}

.last-title {
  font-size: 17px;
}

.last-meta {
  display: flex;
  gap: 4px 6px;
  flex-wrap: wrap;
  align-items: baseline;
  font-size: 13px;
  color: var(--muted);
}

.last-meta .num {
  font-size: 15px;
  color: var(--ink);
}

.last-meta .num:not(:first-child) {
  margin-left: 6px;
}

.go {
  flex-shrink: 0;
  color: var(--muted);
}

/* Objectif : une ligne discrète quand il n'y en a pas */
.set-goal {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  align-self: flex-start;
  min-height: 44px;
  font-size: 15px;
  font-weight: 600;
  color: var(--ink-2);
}

.set-goal svg:first-child {
  color: var(--accent-text);
}

.all {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  align-self: center;
}

/*
 * Téléphone : une seule colonne, dans l'ordre carte principale, semaine, puis le reste plus calme
 * (alertes, cartes secondaires, objectif). Les deux colonnes n'existent qu'à partir de la tablette.
 */
.col-main,
.col-side {
  display: contents;
}

.col-main > *,
.col-side > * {
  animation: rise 0.5s var(--ease-out) backwards;
}

.focus {
  order: 1;
  animation-delay: 60ms;
}

.alerts {
  order: 0;
}

.col-main > :deep(.week) {
  order: 2;
  animation-delay: 140ms;
}

.secondary {
  order: 3;
  animation-delay: 200ms;
}

.goal-card,
.set-goal {
  order: 4;
  animation-delay: 240ms;
}

.all {
  order: 5;
}

/* Tablette et ordinateur : à gauche la carte principale et la semaine ; à droite le reste */
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

  .focus {
    gap: 20px;
    padding: 28px;
  }

  .focus-run {
    grid-template-columns: 112px minmax(0, 1fr);
    gap: 20px;
  }

  .focus-title {
    font-size: 30px;
  }

  .set-goal,
  .all {
    align-self: flex-start;
  }
}

@media (min-width: 1080px) {
  .home > .col-main {
    grid-column: 1 / span 8;
  }

  .home > .col-side {
    grid-column: 9 / -1;
  }

  .focus-run {
    grid-template-columns: 148px minmax(0, 1fr);
    gap: 24px;
  }

  .focus-title {
    font-size: 36px;
  }
}
</style>
