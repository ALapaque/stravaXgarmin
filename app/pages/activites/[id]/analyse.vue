<script setup lang="ts">
import { Gauge, HeartPulse, Lightbulb, ArrowRight, Check, RefreshCw } from 'lucide-vue-next'
import { aiError, useAiResults, type Analysis } from '~/composables/useAi'

const route = useRoute()
const { byId, published, isPublished, publishBlock } = useActivities()
const { entries, undo } = useHistory()
const { analyse } = useAi()
const { connected: aiConnected } = useChatGpt()
const { show } = useToast()

const a = computed(() => byId(String(route.params.id)))
if (!a.value) throw createError({ statusCode: 404, statusMessage: 'Activité introuvable' })

useHead({ title: 'Analyse · stravaXgarmin' })

// Analyse demandée seulement avec ChatGPT connecté ; sinon un exemple flouté, jamais un faux résultat
const PLACEHOLDER: Analysis = {
  score: 0,
  verdict: 'Analyse de ta séance',
  findings: [
    { kind: 'ok' as const, title: 'Régularité', text: 'Ce que l’IA a remarqué sur ton allure.' },
    { kind: 'ko' as const, title: 'Fréquence cardiaque', text: 'Ce que l’IA a remarqué sur ton cœur.' },
    { kind: 'tip' as const, title: 'Pour la prochaine fois', text: 'Un conseil pour ta prochaine séance.' },
  ],
}
// Analyse déjà faite pour cette course : on la reprend telle quelle (gardée dans le navigateur)
const results = useAiResults()
const saved = computed(() => (a.value ? results.value.analyses[a.value.id] : undefined))
const fresh = ref<Analysis>()
const result = computed<Analysis>(() => fresh.value ?? saved.value ?? PLACEHOLDER)
const done = computed(() => Boolean(fresh.value ?? saved.value))
const loading = ref(false)
const error = ref('')

async function load(again = false) {
  if (!a.value || !aiConnected.value || (done.value && !again)) return
  loading.value = true
  error.value = ''
  try {
    const r = await analyse(a.value)
    fresh.value = r
    results.value = { ...results.value, analyses: { ...results.value.analyses, [a.value.id]: { ...r, at: new Date().toISOString() } } }
  } catch (e) {
    error.value = aiError(e)
  } finally {
    loading.value = false
  }
}
onMounted(() => load())
watch(aiConnected, () => load())
const ICONS = {
  ok: { icon: Gauge, color: 'var(--ok)' },
  ko: { icon: HeartPulse, color: 'var(--ko)' },
  tip: { icon: Lightbulb, color: 'var(--accent-text)' },
}

/** Texte de l'analyse tel qu'il part dans la description Strava. */
const analysisText = computed(() => {
  const r = result.value
  return [r.verdict, ...r.findings.map((f) => `${f.title} : ${f.text}`)].join('\n')
})
// Déjà publiée et identique : rien à faire ; publiée mais relancée depuis : on propose la mise à jour
const publishedText = computed(() => (a.value && isPublished(a.value.id, 'analyse') ? published.value[a.value.id]?.analyse : undefined))
const added = computed(() => publishedText.value !== undefined && publishedText.value === analysisText.value)
const outdated = computed(() => publishedText.value !== undefined && !added.value)
const publishing = ref(false)

async function addToStrava() {
  if (!a.value) return
  publishing.value = true
  const change = await publishBlock(a.value.id, 'analyse', analysisText.value, 'analyse')
  publishing.value = false
  if (change === 'added' || change === 'replaced') {
    show(change === 'added' ? 'Analyse ajoutée à la suite de ta description' : 'Analyse mise à jour sur Strava', {
      label: 'Annuler',
      run: async () => {
        const last = entries.value[0]
        if (last && (await undo(last.id))) show(change === 'added' ? 'Analyse retirée de ta description' : 'Ancienne analyse remise sur Strava')
      },
    })
  } else if (change === 'none') show('Ce texte est déjà dans ta description Strava.')
  else if (change === 'full') show('Ta description Strava est déjà trop longue : rien n’a été ajouté.')
}
</script>

<template>
  <div class="stack">
    <template v-if="a">
      <BackLink :to="`/activites/${a.id}`" :label="displayTitle(a).title" />
      <h1 class="h1">Analyse de la séance</h1>

      <AiLock text="Active l’IA pour analyser tes séances. C’est gratuit avec Gemini.">
      <p v-if="aiConnected && loading" class="card card--pad lead thinking">Analyse de ta séance en cours…</p>
      <div v-else-if="!aiConnected || done" class="stack inner">
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

 </div>
      </AiLock>

      <template v-if="error">
        <p class="err" role="alert">{{ error }}</p>
        <button type="button" class="link retry" @click="load(true)"><RefreshCw :size="18" aria-hidden="true" /> Réessayer</button>
      </template>

      <button v-if="aiConnected && done" type="button" class="btn btn--primary" :disabled="added || publishing" @click="addToStrava">
        {{ added ? 'Ajoutée à la description Strava' : outdated ? 'Mettre à jour sur Strava' : 'Ajouter à la description Strava' }}
        <component :is="added ? Check : ArrowRight" :size="20" aria-hidden="true" />
      </button>
      <button v-if="aiConnected && done && !loading" type="button" class="link retry" @click="load(true)">
        <RefreshCw :size="18" aria-hidden="true" /> Relancer l’analyse
      </button>
    </template>
  </div>
</template>

<style scoped>
.thinking {
  animation: breathe 1.2s ease-in-out infinite alternate;
}

@keyframes breathe {
  to {
    opacity: 0.5;
  }
}

.err {
  margin: 0;
  color: var(--ko);
  font-weight: 600;
}

.retry {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  align-self: flex-start;
}

.inner {
  gap: 16px;
}

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
