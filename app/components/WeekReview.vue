<script setup lang="ts">
/*
 * Lecture par l'IA de la semaine choisie (lundi « from » → dimanche) : points forts, points à surveiller,
 * conseil pour la suite. Ce qui part chez l'IA : les chiffres des courses, le plan suivi de la semaine et les
 * ressentis sur 10 des débriefs, jamais les notes écrites (reviewContext, shared/utils/bilan.ts).
 * Gardée dans le navigateur, une par semaine ; proposée à nouveau quand de nouvelles courses s'ajoutent.
 */
import { Sparkles, ThumbsUp, Eye, ArrowRight, RefreshCw } from 'lucide-vue-next'
import { aiError, useAiResults } from '~/composables/useAi'
import { reviewContext, type WeekPlan } from '#shared/utils/bilan'
import { mondayOf } from '#shared/utils/today'

const props = defineProps<{ from: string; plan?: WeekPlan | null }>()

const { sorted } = useActivities()
const { connected } = useChatGpt()
const { reviewWeek } = useAi()
const { upcoming } = usePlan()
const { goalInfo } = useFitness()
const debriefs = useDebriefState()
const results = useAiResults()

const DAY = 86_400_000
const shift = (d: string, n: number) => new Date(Date.parse(`${d}T12:00:00Z`) + n * DAY).toISOString().slice(0, 10)
const between = (a: string, b: string) => sorted.value.filter((r) => r.localDate >= a && r.localDate <= b)
const runs = computed(() => between(props.from, shift(props.from, 6)))
const before = computed(() => between(shift(props.from, -7), shift(props.from, -1)))
const current = computed(() => props.from === mondayOf(TODAY))
const key = computed(() => runs.value.map((a) => a.id).join(','))

const saved = computed(() => results.value.reviews?.[props.from] ?? null)
const stale = computed(() => Boolean(saved.value && saved.value.key !== key.value))
const loading = ref(false)
const error = ref('')

async function run() {
  if (!runs.value.length) return
  loading.value = true
  error.value = ''
  try {
    const ctx = reviewContext({
      plan: props.plan ?? null,
      runs: runs.value.map((a) => ({ id: a.id, localDate: a.localDate, title: displayTitle(a).title })),
      debriefs: debriefs.value ?? {},
    })
    const r = await reviewWeek(runs.value, {
      previous: { km: before.value.reduce((s, a) => s + a.distanceKm, 0), count: before.value.length },
      // La suite du plan n'a de sens que pour la semaine en cours
      next: current.value ? upcoming.value.slice(0, 5).map((s) => `${planDay(s.date)} : ${s.title}`) : undefined,
      goal: goalInfo.value && !goalInfo.value.past ? `${goalInfo.value.name || goalInfo.value.distance} dans ${goalInfo.value.days} jours` : undefined,
      ...ctx,
    })
    const reviews = { ...(results.value.reviews ?? {}), [props.from]: { ...r, at: new Date().toISOString(), key: key.value } }
    results.value = { ...results.value, reviews }
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
      <h2 id="review-title" class="h2">La lecture de l’IA</h2>
      <span class="label">par IA</span>
    </div>

    <AiLock v-if="!connected" text="Active l’IA pour une lecture de ta semaine : ce qui a marché, ce qui fatigue, la suite. C’est gratuit avec Gemini.">
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
        {{ loading ? 'Lecture en cours…' : 'Demander la lecture de ma semaine' }}
        <Sparkles :size="20" aria-hidden="true" />
      </button>
      <button v-else type="button" class="link again" :disabled="loading" @click="run">
        <RefreshCw :size="16" :class="{ spin: loading }" aria-hidden="true" />
        {{ loading ? 'Lecture en cours…' : stale ? 'Nouvelles courses : relancer la lecture' : 'Relancer la lecture' }}
      </button>
    </template>
    <p v-if="!saved" class="fine">Partent chez l’IA : tes chiffres, le plan suivi et tes ressentis sur 10. Jamais les notes que tu écris.</p>
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
