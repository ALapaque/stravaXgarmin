<script setup lang="ts">
/*
 * Bilan IA des 7 derniers jours : points forts, points à surveiller, conseil pour la suite.
 * Gardé dans le navigateur ; proposé à nouveau quand de nouvelles courses s'ajoutent.
 */
import { Sparkles, ThumbsUp, Eye, ArrowRight, RefreshCw } from 'lucide-vue-next'
import { aiError, useAiResults } from '~/composables/useAi'

const { sorted } = useActivities()
const { connected } = useChatGpt()
const { reviewWeek } = useAi()
const { upcoming } = usePlan()
const { goalInfo } = useFitness()
const results = useAiResults()

const DAY = 86_400_000
const end = Date.parse(`${TODAY}T23:59:59Z`)
const within = (from: number, to: number) => sorted.value.filter((a) => Date.parse(a.startedAt) > end - from * DAY && Date.parse(a.startedAt) <= end - to * DAY)
const runs = computed(() => within(7, 0))
const before = computed(() => within(14, 7))
const key = computed(() => runs.value.map((a) => a.id).join(','))

const saved = computed(() => results.value.week ?? null)
const stale = computed(() => Boolean(saved.value && saved.value.key !== key.value))
const loading = ref(false)
const error = ref('')

async function run() {
  if (!runs.value.length) return
  loading.value = true
  error.value = ''
  try {
    const r = await reviewWeek(runs.value, {
      previous: { km: before.value.reduce((s, a) => s + a.distanceKm, 0), count: before.value.length },
      next: upcoming.value.slice(0, 5).map((s) => `${planDay(s.date)} : ${s.title}`),
      goal: goalInfo.value && !goalInfo.value.past ? `${goalInfo.value.name || goalInfo.value.distance} dans ${goalInfo.value.days} jours` : undefined,
    })
    results.value = { ...results.value, week: { ...r, at: new Date().toISOString(), key: key.value } }
  } catch (e) {
    error.value = aiError(e)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <section v-if="runs.length" class="review" aria-labelledby="review-title">
    <div class="section-head">
      <h2 id="review-title" class="h2">Bilan de tes 7 derniers jours</h2>
      <span class="label">par IA</span>
    </div>

    <AiLock v-if="!connected" text="Active l’IA pour recevoir le bilan de ta semaine. C’est gratuit avec Gemini.">
      <div class="card card--pad body">
        <p class="headline">Le résumé de ta semaine en une phrase.</p>
        <ul class="points"><li>Un point fort de ta semaine</li><li>Un autre point fort</li><li>Un point à surveiller</li></ul>
      </div>
    </AiLock>

    <template v-else>
      <div v-if="saved" class="card card--pad body" :aria-busy="loading">
        <p class="headline">{{ saved.headline }}</p>
        <ul class="points">
          <li v-for="(w, i) in saved.wins" :key="`w${i}`" :style="{ '--i': i }">
            <span class="ic ok" aria-hidden="true"><ThumbsUp :size="15" /></span>{{ w }}
          </li>
          <li v-for="(w, i) in saved.watch" :key="`a${i}`" :style="{ '--i': saved.wins.length + i }">
            <span class="ic warn" aria-hidden="true"><Eye :size="15" /></span>{{ w }}
          </li>
        </ul>
        <p v-if="saved.next" class="next"><ArrowRight :size="16" aria-hidden="true" /><span><strong>La suite :</strong> {{ saved.next }}</span></p>
      </div>

      <p v-if="error" class="err" role="alert">{{ error }}</p>
      <button v-if="!saved" type="button" class="btn btn--primary" :disabled="loading" @click="run">
        {{ loading ? 'Rédaction du bilan…' : 'Faire le bilan de ma semaine' }}
        <Sparkles :size="20" aria-hidden="true" />
      </button>
      <button v-else type="button" class="link again" :disabled="loading" @click="run">
        <RefreshCw :size="16" :class="{ spin: loading }" aria-hidden="true" />
        {{ loading ? 'Rédaction…' : stale ? 'Nouvelles courses : refaire le bilan' : 'Refaire le bilan' }}
      </button>
    </template>
  </section>
</template>

<style scoped>
.review {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.body {
  display: flex;
  flex-direction: column;
  gap: 14px;
  transition: opacity 0.2s ease;
}

.body[aria-busy='true'] {
  opacity: 0.5;
}

.headline {
  margin: 0;
  font-family: var(--font-display);
  font-weight: var(--display-weight);
  font-size: 22px;
  line-height: 1.2;
  letter-spacing: -0.02em;
}

.points {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
  color: var(--ink-2);
}

.points li {
  display: flex;
  gap: 10px;
  animation: rise 0.45s var(--ease-out) backwards;
  animation-delay: calc(120ms + var(--i, 0) * 70ms);
}

.ic {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border-radius: var(--r-ctrl);
}

.ic.ok {
  color: var(--ok);
  background: color-mix(in srgb, var(--ok) 15%, transparent);
}

.ic.warn {
  color: var(--accent-text);
  background: color-mix(in srgb, var(--accent-text) 15%, transparent);
}

.next {
  display: flex;
  gap: 10px;
  margin: 0;
  padding: 12px;
  border-radius: var(--r-ctrl);
  background: color-mix(in srgb, var(--primary-solid) 10%, transparent);
  color: var(--ink-2);
}

.next svg {
  flex-shrink: 0;
  margin-top: 4px;
  color: var(--accent-text);
}

.err {
  margin: 0;
  color: var(--ko);
  font-weight: 600;
}

.again {
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
