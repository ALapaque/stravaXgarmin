<script setup lang="ts">
/*
 * Journal : « qu'est-ce que j'ai fait, qu'est-ce qui m'attend ? ». Rubriques :
 * - Tout : en tête les 3 prochaines séances, puis une ligne de temps par semaine (courses et séances
 *   sautées en lignes fantômes) ; sur ordinateur, « À venir » reste collé à droite ;
 * - À venir : le plan détaillé (PlanUpcoming, anciennement la page Plan) ;
 * - À débriefer : les courses en attente, chacune avec son bouton.
 * Regroupement par semaine : journalWeeks() (shared/utils/journal.ts).
 */
import { ArrowRight, CalendarClock, ChevronRight, CircleCheckBig, X } from 'lucide-vue-next'
import { journalWeeks } from '#shared/utils/journal'

useHead({ title: 'Journal · stravaXgarmin' })

const { sorted: activities, byId } = useActivities()
const { toDebrief } = useDebriefs()
const { accounts } = useAccounts()
const { active: demo } = useDemo()
const { list: plan, upcoming, done } = usePlan()

// Le nombre de courses à débriefer dépend de l'état gardé : le point d'attention n'arrive qu'après le montage
const mounted = ref(false)
onMounted(() => (mounted.value = true))

const { tab, direction } = useTab(['tout', 'a-venir', 'a-debriefer'] as const, 'tout')
useSubnav('journal', 'Rubriques du journal', () => [
  { id: 'tout', label: 'Tout', icon: 'all' },
  { id: 'a-venir', label: 'À venir', icon: 'upcoming' },
  { id: 'a-debriefer', label: 'À débriefer', icon: 'todo', dot: mounted.value && toDebrief.value.length > 0 },
], tab)

const sessions = computed(() => plan.value.filter((s) => !s.synthetic))
const weeks = computed(() => journalWeeks({ today: TODAY, runs: activities.value, sessions: sessions.value, done: done.value }))
/** Les 3 prochaines séances pas encore faites */
const next3 = computed(() => {
  const ok = new Set(done.value)
  return upcoming.value.filter((s) => !ok.has(s.id)).slice(0, 3)
})
const hasPlanSource = computed(() => accounts.value.garmin.connected || demo.value)

const shortDay = new Intl.DateTimeFormat('fr-BE', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`
function weekSummary(w: { km: number; runs: number; planned: number; done: number }) {
  const km = `${formatKm(w.km)} km`
  return w.planned ? `${km} · ${w.done} ${w.planned > 1 ? 'séances' : 'séance'} sur ${w.planned}` : `${km} · ${plural(w.runs, 'course', 'courses')}`
}
</script>

<template>
  <div class="stack stack--wide journal">
    <AppHeader eyebrow="Ton plan et tes courses" title="Journal" />

    <ConnectPrompt v-if="!activities.length && !accounts.strava.connected && !demo" />

    <Transition v-else :name="`tab-${direction}`" mode="out-in">
      <!-- ── Tout : à venir en tête, puis la ligne de temps ── -->
      <div v-if="tab === 'tout'" key="tout" class="panel everything">
        <aside class="ahead" aria-labelledby="ahead-title">
          <div class="section-head">
            <h2 id="ahead-title" class="h2">À venir</h2>
            <NuxtLink v-if="next3.length" to="/journal?onglet=a-venir" class="link small">Tout le plan <ChevronRight :size="15" aria-hidden="true" /></NuxtLink>
          </div>
          <div v-if="next3.length" class="card list">
            <SessionCard v-for="s in next3" :key="s.id" :session="s" compact />
          </div>
          <NuxtLink v-else-if="hasPlanSource" to="/journal?onglet=a-venir" class="card row plan-hint">
            <span class="tile" style="--tile: var(--accent-text)" aria-hidden="true"><CalendarClock :size="20" /></span>
            <span class="row__main">
              <span class="title">Aucune séance prévue</span>
              <span class="label">Exporte tes séances depuis Kiprun</span>
            </span>
            <ChevronRight class="go" :size="18" aria-hidden="true" />
          </NuxtLink>
          <NuxtLink v-else to="/connexion/garmin" class="card row plan-hint">
            <span class="tile" style="--tile: var(--accent-text)" aria-hidden="true"><CalendarClock :size="20" /></span>
            <span class="row__main">
              <span class="title">Ton plan ici</span>
              <span class="label">Connecte Garmin pour voir tes séances</span>
            </span>
            <ChevronRight class="go" :size="18" aria-hidden="true" />
          </NuxtLink>
        </aside>

        <section class="past" aria-label="Ce que tu as fait, semaine par semaine">
          <ol v-if="weeks.length" class="timeline">
            <li v-for="(w, wi) in weeks" :key="w.from" class="wk" :class="{ current: w.current, quiet: !w.items.length }" :style="{ '--w': Math.min(wi, 6) }">
              <header class="wk-head">
                <span class="node" aria-hidden="true" />
                <h3 class="wk-title">{{ w.label }}</h3>
                <span class="wk-sum">
                  <span v-if="w.planned" class="pips" aria-hidden="true">
                    <span v-for="k in Math.min(w.planned, 7)" :key="k" class="pip" :class="{ on: k <= w.done }" />
                  </span>
                  <span class="label">{{ weekSummary(w) }}</span>
                </span>
              </header>
              <div v-if="w.items.length" class="card list wk-list">
                <template v-for="it in w.items" :key="it.kind + it.id">
                  <ActivityRow v-if="it.kind === 'run' && byId(it.id)" :activity="byId(it.id)!" />
                  <div v-else-if="it.kind === 'skipped'" class="row ghost">
                    <span class="ghost-ic" aria-hidden="true"><X :size="18" /></span>
                    <span class="row__main">
                      <span class="title">Séance sautée · {{ it.title }}</span>
                      <span class="label">{{ shortDay.format(new Date(`${it.date}T12:00:00Z`)) }}</span>
                    </span>
                  </div>
                </template>
              </div>
              <p v-else class="fine wk-empty">Aucune course cette semaine.</p>
            </li>
          </ol>
          <p v-else class="card card--pad lead">Aucune course sur les 60 derniers jours. Dès qu’une course arrive sur Strava, elle apparaîtra ici.</p>
        </section>
      </div>

      <!-- ── À venir : le plan détaillé ── -->
      <div v-else-if="tab === 'a-venir'" key="a-venir" class="panel">
        <PlanUpcoming />
      </div>

      <!-- ── À débriefer ── -->
      <div v-else key="a-debriefer" class="panel">
        <template v-if="toDebrief.length">
          <p class="lead">{{ toDebrief.length > 1 ? `${toDebrief.length} courses attendent ton débrief : vingt secondes chacune pour boucler tes séances.` : 'Une course attend ton débrief : vingt secondes pour boucler ta séance.' }}</p>
          <div class="todo-list">
            <article v-for="a in toDebrief" :key="a.id" class="card todo">
              <ActivityRow :activity="a" />
              <div class="todo-foot">
                <NuxtLink :to="`/activites/${a.id}/debrief`" class="btn btn--primary btn--sm">
                  Débriefer <ArrowRight :size="18" aria-hidden="true" />
                </NuxtLink>
              </div>
            </article>
          </div>
        </template>
        <section v-else class="card card--pad all-done">
          <span class="tile" style="--tile: var(--ok)" aria-hidden="true"><CircleCheckBig :size="24" /></span>
          <h2 class="h2">Tout est à jour.</h2>
          <p class="lead">Chaque course a son débrief. La prochaine t’attendra ici.</p>
        </section>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* ───── Tout ───── */
.everything {
  gap: 26px;
}

.ahead {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.small {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 0;
  min-height: 44px;
  font-size: 14px;
}

.plan-hint {
  align-items: center;
}

.go {
  flex-shrink: 0;
  color: var(--muted);
}

/* Ligne de temps : un fil à gauche, un repère par semaine */
.timeline {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 22px;
  margin: 0;
  padding: 0 0 0 22px;
  list-style: none;
}

.timeline::before {
  content: '';
  position: absolute;
  top: 10px;
  bottom: 0;
  left: 5px;
  width: 2px;
  border-radius: 2px;
  background: linear-gradient(180deg, var(--accent-text), var(--line-strong) 14%, var(--line) 80%, transparent);
}

.wk {
  display: flex;
  flex-direction: column;
  gap: 10px;
  animation: rise 0.5s var(--ease-out) backwards;
  animation-delay: calc(80ms + var(--w) * 60ms);
}

.wk-head {
  position: relative;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}

.node {
  position: absolute;
  top: 5px;
  left: -22px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--bg);
  box-shadow: inset 0 0 0 2px var(--line-strong);
}

.current .node {
  background: var(--accent-text);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent-text) 22%, transparent), 0 0 14px var(--accent-text);
}

.wk-title {
  margin: 0;
  font-family: var(--font-display);
  font-weight: var(--title-weight);
  font-size: 17px;
  line-height: 1.3;
}

.current .wk-title {
  color: var(--accent-text);
}

.wk-sum {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

/* Séances de la semaine : pleines si faites */
.pips {
  display: inline-flex;
  gap: 3px;
}

.pip {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  box-shadow: inset 0 0 0 1.5px var(--line-strong);
}

.pip.on {
  background: var(--ok);
  box-shadow: none;
}

.quiet .wk-title {
  color: var(--muted);
}

.wk-empty {
  margin-top: -4px;
}

/* Séance sautée : ligne fantôme, en pointillé */
.ghost {
  gap: 14px;
  min-height: 60px;
  padding: 10px 14px;
  color: var(--muted);
  background: repeating-linear-gradient(135deg, transparent 0 7px, color-mix(in srgb, var(--line) 70%, transparent) 7px 8px);
}

.ghost-ic {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 56px;
  height: 40px;
  border-radius: var(--r-ctrl);
  border: 1.5px dashed var(--line-strong);
}

.ghost .title {
  font-weight: 600;
  color: var(--ink-2);
}

/* ───── À débriefer ───── */
.todo-list {
  display: grid;
  gap: 12px;
}

.todo {
  overflow: hidden;
}

.todo-foot {
  display: flex;
  justify-content: flex-end;
  padding: 0 14px 14px;
}

.todo-foot .btn {
  min-width: 160px;
}

.all-done {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-width: 560px;
}

/* Tablette : la liste des courses à débriefer en grille */
@media (min-width: 720px) {
  .todo-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

/* Ordinateur : la ligne de temps à gauche, « À venir » collé à droite */
@media (min-width: 1080px) {
  .everything {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 340px;
    align-items: start;
    gap: 32px;
  }

  .ahead {
    grid-column: 2;
    grid-row: 1;
    position: sticky;
    top: 68px;
  }

  .past {
    grid-column: 1;
    grid-row: 1;
  }
}
</style>
