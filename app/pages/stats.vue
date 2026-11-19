<script setup lang="ts">
import { ArrowRight, Trophy, CalendarRange, CalendarDays } from 'lucide-vue-next'
import { aiError, useAiResults } from '~/composables/useAi'

useHead({ title: 'Stats · stravaXgarmin' })

const { sorted } = useActivities()
const { connected: aiConnected } = useChatGpt()
const { accounts } = useAccounts()
const { active: demo } = useDemo()
const { estimateLevel } = useAi()
const { bests, fromGarmin } = useRecords()
const { shoes } = useFitness()

const { tab, direction } = useTab(['forme', 'records', 'niveau', 'chaussures'] as const, 'forme')
// Rubriques affichées sur la deuxième face de la barre du bas
useSubnav('stats', 'Rubriques des stats', [
  { id: 'forme', label: 'Forme', icon: 'forme' },
  { id: 'records', label: 'Records', icon: 'records' },
  { id: 'niveau', label: 'Niveau IA', icon: 'ia' },
  { id: 'chaussures', label: 'Chaussures', icon: 'shoes' },
], tab)
const results = useAiResults()

// Courses des deux dernières semaines
const since = lastDays(14)[0]!.key
const recent = computed(() => sorted.value.filter((a) => a.startedAt.slice(0, 10) >= since))

// Les séances intenses donnent de meilleures estimations : cochées par défaut
const selected = ref<string[]>(recent.value.filter((a) => a.type !== 'recovery').map((a) => a.id))
const shortDate = new Intl.DateTimeFormat('fr-BE', { day: 'numeric', month: 'short', timeZone: 'Europe/Brussels' })
// Dernière estimation, gardée entre deux pages et deux visites
const level = computed(() => results.value.level)
const estimatedOn = computed(() => {
  const at = results.value.level?.at
  if (!at) return ''
  const d = new Date(at)
  const today = new Date().toDateString() === d.toDateString()
  return today
    ? `aujourd’hui à ${d.toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Brussels' })}`
    : `le ${shortDate.format(d)}`
})
const loading = ref(false)
const error = ref('')

async function run() {
  loading.value = true
  error.value = ''
  try {
    const l = await estimateLevel(recent.value.filter((a) => selected.value.includes(a.id)))
    results.value = { ...results.value, level: { ...l, at: new Date().toISOString() } }
  } catch (e) {
    error.value = aiError(e)
  } finally {
    loading.value = false
  }
}

const n = computed(() => selected.value.length)
</script>

<template>
  <div class="stack stack--wide">
    <div class="title-block">
      <h1 class="h1 h1--xl">Stats</h1>
    </div>

    <ConnectPrompt v-if="!sorted.length && !accounts.strava.connected && !demo" text="Tes records, ton niveau estimé et tes récaps apparaîtront ici une fois Strava connecté." />

    <template v-else>
    <Transition :name="`tab-${direction}`" mode="out-in">
      <div v-if="tab === 'forme'" key="forme" class="panel cols">
        <GoalCard class="span-all" />

        <FormePanel />
        <NuxtLink v-if="!accounts.garmin.connected && !demo" to="/connexion/garmin" class="card card--pad lead hint-card">
          Connecte Garmin pour voir ta VO2max, ton statut d’entraînement, ta récupération et tes temps prédits.
        </NuxtLink>

        <LoadChart />
      </div>

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
              <span class="label">{{ b.time ? [b.activity?.garminName ?? b.name, b.date ? shortDate.format(new Date(b.date)) : ''].filter(Boolean).join(' · ') : 'Pas encore couru' }}</span>
            </span>
            <span class="num pr">{{ b.time ? formatDuration(b.time) : '–' }}</span>
          </component>
        </div>
        </div>
        <div class="col">
          <h2 class="h2">Tes bilans</h2>
        <div class="grid-2">
          <NuxtLink to="/recap" class="card recap-link">
            <span class="tile" style="--tile: var(--info)" aria-hidden="true"><CalendarDays :size="22" /></span>
            <span class="title">Récap semaine</span>
          </NuxtLink>
          <NuxtLink to="/recap?p=mois" class="card recap-link">
            <span class="tile" style="--tile: var(--accent-text)" aria-hidden="true"><CalendarRange :size="22" /></span>
            <span class="title">Récap mois</span>
          </NuxtLink>
        </div>
        </div>
      </div>

      <div v-else-if="tab === 'niveau'" key="niveau" class="panel cols">
        <div class="col">
        <div class="section-head ia-head">
          <h2 class="h2">Niveau estimé par IA</h2>
          <span v-if="level" class="label">{{ estimatedOn }}</span>
        </div>
        <AiLock v-if="!aiConnected" text="Active l’IA pour estimer ta VMA, ta VO2max et ton allure seuil. C’est gratuit avec Gemini.">
          <dl class="grid-2 metrics">
            <div v-for="l in ['VMA · km/h', 'VO2max', 'Seuil · /km', 'Semi estimé']" :key="l" class="card metric">
              <dt class="label">{{ l }}</dt>
              <dd class="num">00,0</dd>
            </div>
          </dl>
        </AiLock>
        <p v-else-if="!level" class="card card--pad lead">Coche quelques courses et lance l’analyse pour estimer ta VMA, ta VO2max et ton allure seuil.</p>
        <dl v-else class="grid-2 metrics" :aria-busy="loading">
          <div class="block block--primary metric">
            <dt class="label">VMA · km/h</dt>
            <dd class="num"><CountUp :value="level.vma" :decimals="1" /></dd>
          </div>
          <div class="block block--secondary metric">
            <dt class="label">VO2max</dt>
            <dd class="num"><CountUp :value="level.vo2max" :delay="200" /></dd>
          </div>
          <div class="card metric">
            <dt class="label">Seuil · /km</dt>
            <dd class="num">{{ level.threshold }}</dd>
          </div>
          <div class="card metric">
            <dt class="label">Semi estimé</dt>
            <dd class="num">{{ level.half }}</dd>
          </div>
        </dl>

        </div>
        <div class="col">
        <div class="section-head">
          <h2 class="h2">Courses à analyser</h2>
          <span class="label">14 derniers jours</span>
        </div>

        <fieldset class="card list runs">
          <legend class="sr-only">Courses envoyées à l’analyse</legend>
          <label v-for="a in recent" :key="a.id" class="row">
            <span class="row__main">
              <span class="title" :class="{ dim: !selected.includes(a.id) }">{{ a.garminName }}</span>
              <span class="label">{{ formatKm(a.distanceKm) }} km · {{ formatPace(a.durationSec, a.distanceKm) }} /km</span>
            </span>
            <input v-model="selected" class="check" type="checkbox" :value="a.id">
          </label>
        </fieldset>

        <button v-if="aiConnected" type="button" class="btn btn--primary" :disabled="!n || loading" @click="run">
          {{ loading ? 'Analyse en cours…' : `Analyser ${n} course${n > 1 ? 's' : ''}` }}
          <ArrowRight :size="20" aria-hidden="true" />
        </button>
        <p v-if="error" class="err" role="alert">{{ error }}</p>
        <p class="fine">Estimations par IA à partir de tes courses, pas un test en laboratoire.</p>
        </div>
      </div>

      <div v-else key="chaussures" class="panel panel--narrow">
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
.hint-card {
  display: block;
  max-width: none;
  font-size: 15px;
}

.ia-head {
  margin-top: 8px;
}

.err {
  margin: 0;
  color: var(--ko);
  font-weight: 600;
}

.recap-link {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px;
}

.pr {
  font-size: 20px;
}

.title-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.metrics {
  margin: 0;
  transition: opacity 0.2s ease;
}

.metrics[aria-busy='true'] {
  opacity: 0.5;
}

.metric {
  display: flex;
  flex-direction: column-reverse;
  gap: 6px;
  padding: 18px;
  min-height: 96px;
  justify-content: flex-start;
}

.metric dd {
  margin: 0;
  font-size: 32px;
}

.runs {
  margin: 0;
  padding: 0;
  min-width: 0;
}

.runs .row {
  min-height: 58px;
  padding-block: 10px;
  cursor: pointer;
}

.dim {
  opacity: 0.6;
}

.sr {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}
</style>
