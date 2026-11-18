<script setup lang="ts">
import { Gauge, HeartPulse, Lightbulb, ArrowRight, Check } from 'lucide-vue-next'

const route = useRoute()
const { byId, setStravaDescription } = useActivities()
const { analyse } = useAi()
const { show } = useToast()

const a = computed(() => byId(String(route.params.id)))
if (!a.value) throw createError({ statusCode: 404, statusMessage: 'Activité introuvable' })

useHead({ title: 'Analyse · stravaXgarmin' })

const result = await analyse(a.value)
const ICONS = {
  ok: { icon: Gauge, color: 'var(--ok)' },
  ko: { icon: HeartPulse, color: 'var(--ko)' },
  tip: { icon: Lightbulb, color: 'var(--accent-text)' },
}

const added = computed(() => Boolean(a.value?.stravaDescription))

function addToStrava() {
  if (!a.value) return
  const text = [result.verdict, ...result.findings.map((f) => `${f.title} : ${f.text}`)].join('\n')
  // TODO: PUT /activities/{id} sur l'API Strava avec { description }
  setStravaDescription(a.value.id, text)
  show('Analyse ajoutée à la description Strava')
}
</script>

<template>
  <div class="stack">
    <template v-if="a">
      <BackLink :to="`/activites/${a.id}`" :label="a.garminName" />
      <h1 class="h1">Analyse de la séance</h1>

      <section class="block block--primary score">
        <div>
          <p class="num value"><CountUp :value="result.score" :delay="200" /></p>
          <p class="label">Régularité /100</p>
        </div>
        <p class="verdict">{{ result.verdict }}</p>
      </section>

      <ul class="card list findings">
        <li v-for="f in result.findings" :key="f.title" class="row">
          <span class="tile" :style="{ '--tile': ICONS[f.kind].color }" aria-hidden="true">
            <component :is="ICONS[f.kind].icon" :size="22" />
          </span>
          <span class="row__main">
            <span class="title">{{ f.title }}</span>
            <span class="text">{{ f.text }}</span>
          </span>
        </li>
      </ul>

      <button type="button" class="btn btn--primary" :disabled="added" @click="addToStrava">
        {{ added ? 'Ajouté à la description Strava' : 'Ajouter à la description Strava' }}
        <component :is="added ? Check : ArrowRight" :size="20" aria-hidden="true" />
      </button>
    </template>
  </div>
</template>

<style scoped>
.score {
  display: flex;
  align-items: center;
  gap: 16px;
}

.value {
  margin: 0;
  font-size: 56px;
}

.verdict {
  margin: 0;
  font-weight: 600;
  line-height: 1.35;
}

.findings {
  margin: 0;
  padding: 0;
  list-style: none;
}

.findings .row {
  align-items: flex-start;
}

.findings .title {
  white-space: normal;
}

.text {
  color: var(--ink-2);
  font-size: 15px;
}
</style>
