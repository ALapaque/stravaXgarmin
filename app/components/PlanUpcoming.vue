<script setup lang="ts">
/*
 * Les prochaines séances du plan (calendrier Garmin) : une carte par séance avec son profil, son déroulé
 * détaillé et sa source ; états vides (Garmin pas connecté, rien de prévu) avec l'aide pour exporter depuis
 * Kiprun, et le bouton de relecture. Rubrique « À venir » du Journal (anciennement la page Plan).
 */
import { CalendarClock, ChevronDown, RefreshCw, Repeat } from 'lucide-vue-next'
import type { PlanLine } from '~/composables/usePlan'

const { upcoming, state, load } = usePlan()
const { accounts } = useAccounts()
const { active: demo } = useDemo()
const { show } = useToast()
const loading = ref(false)
const garmin = computed(() => accounts.value.garmin.connected)

async function refresh() {
  loading.value = true
  try {
    await load(true)
    show('Plan à jour')
  } catch (e) {
    show((e as { data?: { statusMessage?: string } }).data?.statusMessage ?? 'Calendrier Garmin injoignable')
  } finally {
    loading.value = false
  }
}

const DOT: Record<string, string> = {
  warmup: 'var(--info)',
  cooldown: 'var(--info)',
  interval: 'var(--accent-text)',
  recovery: 'var(--ok)',
  rest: 'var(--muted)',
  other: 'var(--type-long)',
  repeat: 'var(--ink)',
}
const flat = (lines: PlanLine[]) => lines

// La prochaine séance montre son déroulé ; les suivantes le déplient à la demande
const opened = ref<Record<string, boolean>>({})
const isOpen = (id: string, i: number) => opened.value[id] ?? i === 0
const toggle = (id: string, i: number) => (opened.value = { ...opened.value, [id]: !isOpen(id, i) })
const hasDetail = (s: { lines: PlanLine[]; description: string | null }) => Boolean(s.lines.length || s.description)
</script>

<template>
  <div class="upcoming">

    <section v-if="!garmin && !demo" class="card card--pad empty">
      <span class="empty-icon" aria-hidden="true"><CalendarClock :size="26" /></span>
      <h2 class="h2">Ton plan Kiprun ici</h2>
      <p class="lead">
        Connecte Garmin, puis dans Kiprun Pacer touche « Exporter » sur tes séances : elles arrivent dans ton calendrier Garmin
        et s’affichent ici, avec leur déroulé.
      </p>
      <NuxtLink to="/connexion/garmin" class="btn btn--primary">Connecter Garmin</NuxtLink>
    </section>

    <template v-else>
      <section v-if="!upcoming.length" class="card card--pad empty">
        <span class="empty-icon" aria-hidden="true"><CalendarClock :size="26" /></span>
        <h2 class="h2">Aucune séance prévue</h2>
        <p class="lead">
          Dans Kiprun Pacer, ouvre une séance et touche « Exporter » : elle arrivera dans ton calendrier Garmin, puis ici.
          Les séances Garmin Coach et celles ajoutées à la main apparaissent aussi.
        </p>
      </section>

      <ol class="timeline">
        <li v-for="(s, i) in upcoming" :key="s.id" class="session" :style="{ '--i': i }">
          <p class="day eyebrow" :class="{ soon: i === 0 }">{{ planDay(s.date) }}</p>
          <article class="card card--pad body" :class="{ first: i === 0 }">
            <header class="s-head">
              <h2 class="s-title">{{ s.title }}</h2>
              <span v-if="s.provider" class="provider">{{ s.provider }}</span>
            </header>
            <p class="s-meta">
              <span v-if="s.durationSec"><strong class="num">{{ formatHours(s.durationSec) }}</strong> environ</span>
              <span v-if="s.distanceM"><strong class="num">{{ formatKm(s.distanceM / 1000) }}</strong> km</span>
            </p>
            <WorkoutProfile v-if="s.blocks.length" :blocks="s.blocks" :height="i === 0 ? 72 : 48" />
            <button
              v-if="hasDetail(s)"
              type="button"
              class="more"
              :aria-expanded="isOpen(s.id, i)"
              :aria-controls="`detail-${s.id}`"
              @click="toggle(s.id, i)"
            >
              {{ isOpen(s.id, i) ? 'Masquer le déroulé' : 'Voir le déroulé' }}
              <ChevronDown :size="16" :class="{ up: isOpen(s.id, i) }" aria-hidden="true" />
            </button>
            <div v-show="isOpen(s.id, i)" :id="`detail-${s.id}`" class="detail">
            <ul v-if="s.lines.length" class="steps">
              <li v-for="(l, k) in flat(s.lines)" :key="k" class="step">
                <template v-if="l.kind === 'repeat'">
                  <span class="rep"><Repeat :size="14" aria-hidden="true" /> {{ l.reps }} fois</span>
                  <ul class="steps inner">
                    <li v-for="(c, j) in l.children" :key="j" class="step">
                      <span class="dot" :style="{ '--d': DOT[c.kind] }" aria-hidden="true" />{{ c.text }}
                    </li>
                  </ul>
                </template>
                <template v-else>
                  <span class="dot" :style="{ '--d': DOT[l.kind] }" aria-hidden="true" />{{ l.text }}
                </template>
              </li>
            </ul>
            <p v-if="s.description" class="desc">{{ s.description }}</p>
            </div>
          </article>
        </li>
      </ol>

      <button v-if="garmin" type="button" class="link refresh" :disabled="loading" @click="refresh">
        <RefreshCw :size="16" :class="{ spin: loading }" aria-hidden="true" />
        {{ loading ? 'Lecture du calendrier…' : 'Relire le calendrier Garmin' }}
      </button>
      <p class="fine">
        Kiprun Pacer n’a pas d’API : seules les séances exportées vers Garmin apparaissent.
        <template v-if="state?.at">Mis à jour {{ new Date(state.at).toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' }) }}.</template>
      </p>
    </template>
  </div>
</template>

<style scoped>
.upcoming {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.empty {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.empty-icon {
  display: grid;
  place-items: center;
  width: 52px;
  height: 52px;
  border-radius: var(--r-ctrl);
  color: var(--accent-text);
  background: color-mix(in srgb, var(--accent-text) 16%, transparent);
}

.timeline {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 18px;
  margin: 0;
  padding: 0 0 0 18px;
  list-style: none;
}

/* Fil du temps à gauche */
.timeline::before {
  content: '';
  position: absolute;
  top: 8px;
  bottom: 8px;
  left: 4px;
  width: 2px;
  border-radius: 2px;
  background: linear-gradient(180deg, var(--accent-text), var(--line) 60%, transparent);
}

.session {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
  animation: rise 0.55s var(--ease-out) backwards;
  animation-delay: calc(120ms + var(--i) * 90ms);
}

.session::before {
  content: '';
  position: absolute;
  top: 4px;
  left: -18px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--bg);
  box-shadow: inset 0 0 0 2px var(--line-strong);
}

.session:first-child::before {
  background: var(--accent-text);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent-text) 25%, transparent), 0 0 16px var(--accent-text);
}

.day.soon {
  color: var(--accent-text);
}

.body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.body.first {
  box-shadow: var(--surface-shadow), 0 0 0 1px color-mix(in srgb, var(--accent-text) 30%, transparent);
}

.s-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.s-title {
  margin: 0;
  font-family: var(--font-display);
  font-weight: var(--display-weight);
  font-size: 21px;
  line-height: 1.15;
  letter-spacing: -0.02em;
}

.provider {
  flex-shrink: 0;
  padding: 3px 9px;
  border-radius: 99px;
  font-size: 11px;
  font-weight: 700;
  color: var(--ink-2);
  background: var(--surface-2);
}

.s-meta {
  display: flex;
  gap: 16px;
  margin: 0;
  font-size: 13px;
  color: var(--muted);
}

.s-meta strong {
  font-size: 17px;
  color: var(--ink);
}

/* Tablette et ordinateur : la prochaine séance en grand, les suivantes en grille */
@media (min-width: 720px) {
  .timeline {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: start;
    gap: 20px;
    padding-left: 0;
  }

  .timeline::before,
  .session::before {
    display: none;
  }

  .session:first-child {
    grid-column: 1 / -1;
  }

  .session:first-child .body {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    column-gap: 28px;
    align-items: start;
    padding: 26px;
  }

  .session:first-child .s-head,
  .session:first-child .s-meta,
  .session:first-child :deep(.profile) {
    grid-column: 1;
  }

  .session:first-child .more {
    display: none;
  }

  /* Le déroulé de la prochaine séance reste ouvert, à droite du profil */
  .session:first-child .detail {
    display: flex !important;
    grid-column: 2;
    grid-row: 1 / span 4;
  }

  .session:first-child .s-title {
    font-size: 28px;
  }

  .empty {
    max-width: 640px;
  }
}

@media (min-width: 1280px) {
  .timeline {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

.more {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  align-self: flex-start;
  min-height: 36px;
  padding: 0;
  border: 0;
  background: none;
  color: var(--link);
  font: inherit;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}

.more svg {
  transition: transform 0.3s var(--ease-spring);
}

.more .up {
  transform: rotate(180deg);
}

.detail {
  display: flex;
  flex-direction: column;
  gap: 12px;
  animation: rise 0.35s var(--ease-out);
}

.steps {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 2px 0 0;
  padding: 0;
  list-style: none;
  font-size: 14px;
  color: var(--ink-2);
}

.steps.inner {
  margin: 6px 0 0 6px;
  padding-left: 12px;
  border-left: 2px solid var(--line-strong);
}

.step {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px;
}

.dot {
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--d);
  box-shadow: 0 0 8px var(--d);
  transform: translateY(-1px);
}

.rep {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  font-weight: 700;
  color: var(--ink);
}

.desc {
  margin: 0;
  font-size: 14px;
  color: var(--muted);
  font-style: italic;
}

.refresh {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  align-self: flex-start;
}

.spin {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
