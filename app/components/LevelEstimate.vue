<script setup lang="ts">
/*
 * Niveau estimé par l'IA (VMA, VO2max, allure seuil, semi) à partir des courses des 14 derniers jours.
 * Repli de la rubrique Forme quand Garmin n'est pas connecté (anciennement la rubrique « Niveau IA »).
 */
import { ArrowRight } from 'lucide-vue-next'
import { aiError, useAiResults } from '~/composables/useAi'

const { sorted } = useActivities()
const { connected: aiConnected } = useChatGpt()
const { estimateLevel } = useAi()
const results = useAiResults()

// Courses des deux dernières semaines
const since = lastDays(14)[0]!.key
const recent = computed(() => sorted.value.filter((a) => a.localDate >= since))

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
  <div class="cols level">
    <div class="col">
      <div class="section-head">
        <h2 class="h2">Ton niveau estimé</h2>
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

      <fieldset v-if="recent.length" class="card list runs">
        <legend class="sr-only">Courses envoyées à l’analyse</legend>
        <label v-for="a in recent" :key="a.id" class="row">
          <span class="row__main">
            <span class="title" :class="{ dim: !selected.includes(a.id) }">{{ displayTitle(a).title }}</span>
            <span class="label">{{ formatKm(a.distanceKm) }} km · {{ formatPace(a.durationSec, a.distanceKm) }} /km</span>
          </span>
          <input v-model="selected" class="check" type="checkbox" :value="a.id">
        </label>
      </fieldset>
      <p v-else class="card card--pad lead">Aucune course sur les 14 derniers jours : cours un peu, puis reviens ici.</p>

      <button v-if="aiConnected && recent.length" type="button" class="btn btn--primary" :disabled="!n || loading" @click="run">
        {{ loading ? 'Analyse en cours…' : `Analyser ${n} course${n > 1 ? 's' : ''}` }}
        <ArrowRight :size="20" aria-hidden="true" />
      </button>
      <p v-if="error" class="err" role="alert">{{ error }}</p>
      <p class="fine">Estimations par IA à partir de tes courses, pas un test en laboratoire.</p>
    </div>
  </div>
</template>

<style scoped>
.err {
  margin: 0;
  color: var(--ko);
  font-weight: 600;
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
</style>
