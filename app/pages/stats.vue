<script setup lang="ts">
import { ArrowRight } from 'lucide-vue-next'

useHead({ title: 'Stats · RunSync' })

const { activities } = useActivities()
const { estimateLevel } = useAi()

// Les séances intenses donnent de meilleures estimations : cochées par défaut
const selected = ref<string[]>(activities.value.filter((a) => a.type !== 'recovery').map((a) => a.id))
const level = ref({ vma: 16.2, vo2max: 52, threshold: '4:38', half: '1:42', count: 3 })
const estimatedOn = ref('le 16 novembre')
const loading = ref(false)

async function run() {
  loading.value = true
  level.value = await estimateLevel(activities.value.filter((a) => selected.value.includes(a.id)))
  estimatedOn.value = 'à l’instant'
  loading.value = false
}

const n = computed(() => selected.value.length)
</script>

<template>
  <div class="title-block">
    <h1 class="h1">Ton niveau</h1>
    <p class="label">Estimé {{ estimatedOn }} sur {{ level.count }} courses</p>
  </div>

  <dl class="grid-2 metrics" :aria-busy="loading">
    <div class="block block--primary metric">
      <dt class="label">VMA · km/h</dt>
      <dd class="num">{{ level.vma.toLocaleString('fr-BE') }}</dd>
    </div>
    <div class="block block--secondary metric">
      <dt class="label">VO2max</dt>
      <dd class="num">{{ level.vo2max }}</dd>
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

  <div class="section-head">
    <h2 class="h2">Courses à analyser</h2>
    <span class="label">30 derniers jours</span>
  </div>

  <fieldset class="card list runs">
    <legend class="sr">Courses envoyées à l’analyse</legend>
    <label v-for="a in activities" :key="a.id" class="row">
      <span class="row__main">
        <span class="title" :class="{ dim: !selected.includes(a.id) }">{{ a.garminName }}</span>
        <span class="label">{{ formatKm(a.distanceKm) }} km · {{ formatPace(a.durationSec, a.distanceKm) }} /km</span>
      </span>
      <input v-model="selected" class="check" type="checkbox" :value="a.id">
    </label>
  </fieldset>

  <button type="button" class="btn btn--primary" :disabled="!n || loading" @click="run">
    {{ loading ? 'Analyse en cours…' : `Analyser ${n} course${n > 1 ? 's' : ''}` }}
    <ArrowRight :size="20" aria-hidden="true" />
  </button>
  <p class="fine">Estimations par IA à partir de tes courses, pas un test en laboratoire.</p>
</template>

<style scoped>
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
