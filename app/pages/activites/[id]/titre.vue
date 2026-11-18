<script setup lang="ts">
import { RefreshCw, ArrowRight } from 'lucide-vue-next'
import type { TitleStyle } from '~/composables/useAi'

const route = useRoute()
const router = useRouter()
const { byId, setStravaName } = useActivities()
const { suggestTitles } = useAi()
const { show } = useToast()

const a = computed(() => byId(String(route.params.id)))
if (!a.value) throw createError({ statusCode: 404, statusMessage: 'Activité introuvable' })

useHead({ title: 'Titre IA · RunSync' })

const style = ref<TitleStyle>('epique')
const round = ref(0)
const ideas = ref<string[]>([])
const chosen = ref('')
const loading = ref(false)

async function load() {
  if (!a.value) return
  loading.value = true
  ideas.value = await suggestTitles(a.value, style.value, round.value)
  chosen.value = ideas.value[0] ?? ''
  loading.value = false
}

watch(style, () => {
  round.value = 0
  load()
})

await load()

function more() {
  round.value++
  load()
}

async function publish() {
  if (!a.value || !chosen.value) return
  // TODO: PUT /activities/{id} sur l'API Strava avec { name }
  setStravaName(a.value.id, chosen.value)
  show('Titre publié sur Strava')
  await router.push(`/activites/${a.value.id}`)
}
</script>

<template>
  <template v-if="a">
    <BackLink :to="`/activites/${a.id}`" :label="a.garminName" />

    <div class="title-block">
      <h1 class="h1">Un titre pour {{ formatDay(a.startedAt).split(' ')[0]!.toLowerCase() }}</h1>
      <p class="label">
        {{ formatKm(a.distanceKm) }} km · {{ formatDuration(a.durationSec) }} · {{ formatPace(a.durationSec, a.distanceKm) }} /km
      </p>
    </div>

    <div class="segmented" role="group" aria-label="Style du titre">
      <button
        v-for="s in TITLE_STYLES"
        :key="s.id"
        type="button"
        :aria-pressed="style === s.id"
        @click="style = s.id"
      >
        {{ s.label }}
      </button>
    </div>

    <fieldset class="card list ideas" :aria-busy="loading">
      <legend class="sr">Choisis un titre</legend>
      <label v-for="t in ideas" :key="t" class="row">
        <span class="row__main"><span class="title">{{ t }}</span></span>
        <input v-model="chosen" class="radio" type="radio" name="title" :value="t">
      </label>
    </fieldset>

    <button type="button" class="btn btn--primary" :disabled="!chosen" @click="publish">
      Publier sur Strava
      <ArrowRight :size="20" aria-hidden="true" />
    </button>

    <div class="foot">
      <button type="button" class="link more" @click="more">
        <RefreshCw :size="18" aria-hidden="true" /> Trois autres idées
      </button>
      <span class="label via">via ChatGPT</span>
    </div>
  </template>
</template>

<style scoped>
.title-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ideas {
  margin: 0;
  padding: 0;
  min-width: 0;
  transition: opacity 0.2s ease;
}

.ideas[aria-busy='true'] {
  opacity: 0.5;
}

.ideas .row {
  cursor: pointer;
}

.ideas .title {
  white-space: normal;
}

.sr {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}

.foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.more {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
}

.via {
  color: var(--chatgpt);
}
</style>
