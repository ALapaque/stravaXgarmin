<script setup lang="ts">
/*
 * Le Débrief : un seul écran pour boucler une course. Cinq temps reliés par un fil :
 * la séance (prévu / fait, issue, type), le ressenti, l'analyse, le titre, et l'aperçu « Sur Strava »
 * qui publie le tout d'un seul envoi (useActivities().publishDebrief). Tout ce qui est saisi est gardé
 * au fur et à mesure (useDebriefs, brouillon) : fermer puis rouvrir retrouve tout.
 * Règles (texte publié, libellés, titre proposé) : shared/utils/debrief.ts.
 */
import { X, Check, ChevronDown, Sparkles, RefreshCw, Gauge, HeartPulse, Lightbulb, ArrowRight, CalendarClock, Clock } from 'lucide-vue-next'
import type { Outcome } from '#shared/utils/compliance'
import type { Debrief, DebriefParts } from '#shared/utils/debrief'
import type { RunType } from '#shared/utils/runs'
import { aiError as aiErrorMessage, useAiResults, type TitleStyle } from '~/composables/useAi'

definePageMeta({ focus: true })

const router = useRouter()
const { id, run: a, state } = useRunPage()
const { sorted, setType, published, isPublished, publishDebrief, refreshDescription, setGarminName } = useActivities()
const { get, save, skip } = useDebriefs()
const plan = usePlan()
const convention = useConvention()
const settings = useSettings()
const { ruleTitle } = useNaming()
const { connected: aiConnected, label: aiLabel } = useChatGpt()
const { analyse, suggestTitles } = useAi()
const { show } = useToast()
const { undo } = useHistory()
const { active: demo } = useDemo()
const { accounts } = useAccounts()

useHead({ title: () => `Débrief · ${a.value ? displayTitle(a.value).title : 'Course'} · stravaXgarmin` })

const courseLink = computed(() => `/activites/${id.value}`)
const d = computed(() => get(id.value))

/** Garde une saisie ; un débrief déjà fait le reste (seule la publication change ce qui est sur Strava). */
function patch(p: Partial<Debrief>) {
  save(id.value, { ...p, status: d.value?.status === 'done' ? 'done' : 'draft' })
}

/* ───── 1 · La séance ───── */

const session = computed(() => (a.value ? plan.sessionFor(a.value) : null))
const result = computed(() => (a.value ? plan.resultFor(a.value) : null))
const sessionSteps = computed(() => {
  const s = session.value
  if (!s) return []
  return s.steps?.length ? s.steps : (parseWorkoutTitle(s.title)?.steps ?? [])
})

const outcome = computed<Outcome>({
  get: () => d.value?.outcome ?? result.value?.outcome ?? 'done',
  set: (v) => patch({ outcome: v }),
})

// Séances prévues à trois jours autour de la course, pour corriger la séance reliée
const choosing = ref(false)
const nearby = computed(() => {
  if (!a.value) return []
  const t = Date.parse(`${a.value.localDate}T12:00:00Z`)
  return plan.list.value.filter((s) => !s.synthetic && Math.abs(Date.parse(`${s.date}T12:00:00Z`) - t) <= 3 * 86_400_000)
})
const chosenPlan = computed(() => {
  if (session.value && !session.value.synthetic) return session.value.id
  return d.value?.planId === 'none' || !session.value ? 'none' : ''
})
function choosePlan(planId: string) {
  patch({ planId })
  choosing.value = false
}

const TYPES: RunType[] = ['easy', 'long', 'interval', 'tempo', 'recovery', 'race']
function chooseType(t: RunType) {
  if (!a.value || a.value.type === t) return
  setType(a.value.id, t)
}

/* ───── 2 · Ton ressenti ───── */

const rpe = computed<number | null>({ get: () => d.value?.rpe ?? null, set: (v) => patch({ rpe: v }) })
const note = computed({ get: () => d.value?.note ?? '', set: (v: string) => patch({ note: v.slice(0, MAX_NOTE) }) })
const noteField = ref<HTMLTextAreaElement>()
/** La zone de texte grandit avec le texte */
function fit() {
  const el = noteField.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight + 2}px`
}

/* ───── 3 · L'analyse ───── */

const results = useAiResults()
const analysis = computed(() => results.value.analyses?.[id.value] ?? null)
const aiState = ref<'idle' | 'loading' | 'error'>('idle')
const aiErr = ref('')
const planContext = computed(() => {
  const s = session.value
  if (!s) return null
  return {
    title: s.title,
    summary: stepsSummary(sessionSteps.value),
    outcome: outcome.value,
    result: result.value?.summary ?? null,
    steps: stepLines(result.value?.steps),
  }
})

async function runAnalysis() {
  const r = a.value
  if (!r || !aiConnected.value) return
  aiState.value = 'loading'
  aiErr.value = ''
  try {
    const got = await analyse(r, { plan: planContext.value, rpe: rpe.value, note: note.value })
    results.value = { ...results.value, analyses: { ...results.value.analyses, [r.id]: { ...got, at: new Date().toISOString() } } }
    aiState.value = 'idle'
  } catch (e) {
    aiErr.value = aiErrorMessage(e)
    aiState.value = 'error'
  }
}
const FINDING = {
  ok: { icon: Gauge, color: 'var(--ok)' },
  ko: { icon: HeartPulse, color: 'var(--ko)' },
  tip: { icon: Lightbulb, color: 'var(--accent-text)' },
}
const aiReturn = computed(() => `/connexion/ia?retour=${encodeURIComponent(`/activites/${id.value}/debrief`)}`)

/* ───── 4 · Le titre ───── */

const failTag = computed(() => convention.failTag.value)
const ownTags = computed(() => parseTitle(a.value?.stravaName).tags)
const seed = computed(() =>
  a.value
    ? seedTitle({
        stravaName: a.value.stravaName,
        planTitle: session.value?.title,
        garminName: a.value.garminId || a.value.garminName !== a.value.stravaName ? a.value.garminName : null,
        ruleTitle: ruleTitle(a.value),
      })
    : '',
)
const titlePart = computed({ get: () => d.value?.title ?? seed.value, set: (v: string) => patch({ title: v }) })

// Titres déjà publiés avec une source, du plus récent au plus ancien (cette course exclue)
const titleHistory = computed(() =>
  sorted.value
    .filter((x) => x.id !== id.value)
    .map((x) => parseTitle(x.stravaName))
    .filter((p) => p.tagged)
    .map((p) => ({ title: p.title, source: p.tags.find((t) => t !== failTag.value) ?? '' }))
    .filter((h) => h.source),
)
const guessed = computed(() =>
  a.value
    ? guessSource({ provider: session.value?.provider, title: titlePart.value, isRace: a.value.type === 'race', known: convention.sources.value, history: titleHistory.value })
    : 'CUSTOM',
)
/** Source choisie ; '' = aucune. Par défaut : celle du titre Strava, sinon celle devinée */
const source = computed({
  get: () => d.value?.source ?? ownTags.value.find((t) => t !== failTag.value) ?? guessed.value,
  set: (v: string) => patch({ source: v }),
})
const fail = computed({ get: () => d.value?.fail ?? outcome.value === 'failed', set: (v: boolean) => patch({ fail: v }) })
const finalTitle = computed(() =>
  convention.enabled.value ? formatTitle({ source: source.value || null, title: titlePart.value, failed: fail.value, failTag: failTag.value }) : parseTitle(titlePart.value).title,
)
const TITLE_MAX = 100

const proposals = computed(() => {
  const r = a.value
  if (!r) return []
  const list: { label: string; text: string }[] = []
  if (session.value && !session.value.synthetic) list.push({ label: 'Séance prévue', text: session.value.title })
  const watch = cleanWatchName(r.garminName).title
  if (watch && !isGenericName(watch) && (r.garminId || r.garminName !== r.stravaName)) list.push({ label: 'Nom de la montre', text: watch })
  const rule = ruleTitle(r)
  if (rule) list.push({ label: 'Règle', text: rule })
  const seen = new Set<string>()
  return list.filter((p) => {
    const k = normalizeTitle(p.text)
    if (!k || seen.has(k)) return false
    seen.add(k)
    return true
  })
})

const style = ref<TitleStyle>('sobre')
const ideas = ref<string[]>([])
const ideasSeen = ref<string[]>([])
const ideasState = ref<'idle' | 'loading' | 'error'>('idle')
const ideasErr = ref('')
const ideasLoaded = ref(false)
async function loadIdeas() {
  const r = a.value
  if (!r || !aiConnected.value) return
  ideasState.value = 'loading'
  ideasErr.value = ''
  try {
    ideas.value = await suggestTitles(r, style.value, ideasSeen.value, session.value?.title)
    ideasSeen.value.push(...ideas.value)
    ideasLoaded.value = true
    ideasState.value = 'idle'
  } catch (e) {
    ideasErr.value = aiErrorMessage(e)
    ideasState.value = 'error'
  }
}
function pickStyle(s: TitleStyle) {
  if (style.value === s) return
  style.value = s
  ideasSeen.value = []
  loadIdeas()
}

/* ───── 5 · Sur Strava ───── */

const PARTS: { key: keyof DebriefParts; label: string }[] = [
  { key: 'note', label: 'Ma note' },
  { key: 'feeling', label: 'Ressenti' },
  { key: 'analysis', label: 'Analyse' },
  { key: 'numbers', label: 'Chiffres' },
  { key: 'shoes', label: 'Chaussures' },
  { key: 'signature', label: 'Signature' },
]
const parts = computed(() => partsOf(settings.value.description))
function togglePart(k: keyof DebriefParts) {
  settings.value.description = { ...parts.value, [k]: !parts.value[k] }
}

const block = computed(() => {
  const r = a.value
  if (!r) return ''
  const an = analysis.value
  return composeBlock({
    note: note.value,
    rpe: rpe.value,
    // Séance libre : l'issue n'est écrite que si tu l'as choisie toi-même
    outcome: session.value || d.value?.outcome ? outcome.value : null,
    resultSummary: session.value ? (result.value?.summary ?? null) : null,
    analysis: an ? { verdict: an.verdict, findings: an.findings.map((f) => ({ title: f.title, text: f.text })) } : null,
    efforts: effortTimes(result.value),
    splits: r.splits,
    shoe: r.shoe ?? null,
    parts: parts.value,
  })
})

// Description relue chez Strava à l'ouverture (en démo, elle est déjà connue)
// Adresse ouverte directement : la course n'arrive qu'après le rechargement de l'état gardé, d'où l'attente
const descState = ref<'idle' | 'loading' | 'error'>('idle')
onMounted(() => {
  let read = false
  watch(
    () => a.value?.stravaId,
    async (stravaId) => {
      if (!stravaId || read || !a.value) return
      read = true
      descState.value = 'loading'
      descState.value = (await refreshDescription(a.value.id)) ? 'idle' : 'error'
    },
    { immediate: true },
  )
  watch(() => Boolean(a.value), (ok) => ok && nextTick(fit), { immediate: true })
})
const current = computed(() => normalizeNewlines(a.value?.stravaDescription))
const previous = computed(() => published.value[id.value]?.debrief)
/** Ton texte : la description sans le débrief publié avant (qui sera remplacé) */
const userText = computed(() => (previous.value ? mergeDescription(current.value, '', previous.value).text : current.value).trim())
const overflow = computed(() => mergeDescription(current.value, block.value, previous.value).change === 'full')

/* ───── Publication ───── */

const isPub = computed(() => isPublished(id.value, 'debrief'))
const everPublished = computed(() => Boolean(d.value?.publishedAt) || isPub.value)
const upToDate = computed(() => {
  const r = a.value
  if (!r || !everPublished.value || finalTitle.value !== r.stravaName) return false
  if (!block.value) return !isPub.value
  return isPub.value && normalizeNewlines(previous.value).trim() === block.value.trim()
})
const publishing = ref(false)
const success = ref(false)
const alsoGarmin = computed(() => Boolean(settings.value.garmin.rename && accounts.value.garmin.connected && a.value?.garminId))
const canPublish = computed(() => !publishing.value && !upToDate.value && finalTitle.value.trim().length > 0 && descState.value !== 'loading' && !overflow.value)
const publishLabel = computed(() => {
  if (publishing.value) return 'Publication…'
  if (!everPublished.value) return alsoGarmin.value ? 'Publier sur Strava et Garmin' : 'Publier sur Strava'
  return upToDate.value ? 'Publié' : 'Mettre à jour sur Strava'
})

/** Les valeurs proposées deviennent des choix au moment de conclure */
const snapshot = (): Partial<Debrief> => ({
  outcome: outcome.value,
  rpe: rpe.value,
  note: note.value,
  source: source.value,
  title: parseTitle(titlePart.value).title,
  fail: d.value?.fail ?? null,
})

const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

async function publish() {
  const r = a.value
  if (!r || !canPublish.value) return
  publishing.value = true
  const name = finalTitle.value
  const res = await publishDebrief(r.id, { name, block: block.value })
  if (!res) {
    publishing.value = false
    return
  }
  if (res.change === 'full') {
    publishing.value = false
    show('Ta description Strava est trop longue pour y ajouter le débrief : rien n’a été publié. Raccourcis-la sur Strava, puis réessaie.')
    return
  }
  // Texte pas pris par Strava (message déjà affiché) : rien n'est marqué publié
  if (block.value && !isPublished(r.id, 'debrief')) {
    publishing.value = false
    return
  }
  if (res.renamed && alsoGarmin.value) await setGarminName(r.id, name, 'debrief')
  save(r.id, { ...snapshot(), status: 'done', block: published.value[r.id]?.debrief ?? null, publishedAt: new Date().toISOString() })
  publishing.value = false
  success.value = true
  await new Promise((ok) => setTimeout(ok, reduced() ? 300 : 1100))
  await router.push(courseLink.value)
  const entries = res.entries
  show(demo.value ? 'Débrief publié (démo)' : 'Débrief publié sur Strava', {
    label: 'Annuler',
    run: async () => {
      // La description d'abord, puis le nom
      let ok = true
      for (const e of entries) ok = (await undo(e)) && ok
      if (entries.length && ok) show('Débrief retiré de Strava')
    },
  })
}

async function keepPrivate() {
  if (!a.value) return
  save(a.value.id, { ...snapshot(), status: 'done' })
  await router.push(courseLink.value)
  show('Débrief enregistré, gardé pour toi')
}

async function noDebrief() {
  if (!a.value) return
  skip(a.value.id)
  await router.push(courseLink.value)
  show('Cette course ne réclame plus de débrief')
}

/* ───── Avancement ───── */

const filled = computed(() => [
  Boolean(outcome.value),
  rpe.value !== null,
  Boolean(analysis.value),
  finalTitle.value.trim().length > 0,
  upToDate.value,
])
const filledCount = computed(() => filled.value.filter(Boolean).length)

const dateLine = computed(() => {
  const r = a.value
  if (!r) return ''
  const place = placeLabel(r)
  return `${formatDay(r.startedAt)} · ${formatTime(r.startedAt)}${place ? ` · ${place}` : ''}`
})
const resultBig = computed(() => {
  const s = result.value?.summary
  if (!s) return null
  const m = s.match(/^(\S+)\s+(.*)$/)
  return m ? { n: m[1]!, rest: m[2]! } : { n: s, rest: '' }
})
</script>

<template>
  <div class="stack stack--wide debrief">
    <RunPending v-if="state !== 'ready' || !a" :state="state === 'missing' ? 'missing' : 'loading'" />
    <template v-else>
      <!-- En-tête -->
      <header class="dh">
        <NuxtLink :to="courseLink" class="close" aria-label="Fermer le débrief"><X :size="22" aria-hidden="true" /></NuxtLink>
        <div class="dh-title">
          <p class="eyebrow">Fin de séance</p>
          <h1 class="h1">Débrief</h1>
        </div>
        <div class="progress" role="img" :aria-label="`${filledCount} étapes sur 5 renseignées`">
          <span class="label">{{ filledCount }}/5</span>
          <span class="segs" aria-hidden="true"><span v-for="(f, i) in filled" :key="i" :class="{ on: f }" /></span>
        </div>
      </header>

      <!-- Rappel de la course -->
      <section class="card recap" aria-label="La course">
        <span class="thumb" :style="{ '--c': RUN_TYPES[a.type].color }">
          <RouteTrace :activity="a" :draw="false" :glow="false" :width="5" />
        </span>
        <div class="recap-main">
          <p class="title recap-title">{{ displayTitle(a).title }}</p>
          <p class="label">{{ dateLine }}</p>
          <dl class="recap-nums">
            <div><dt class="sr-only">Distance</dt><dd><span class="num">{{ formatKm(a.distanceKm) }}</span> km</dd></div>
            <div><dt class="sr-only">Durée</dt><dd><span class="num">{{ formatDuration(a.durationSec) }}</span></dd></div>
            <div><dt class="sr-only">Allure</dt><dd><span class="num">{{ formatPace(a.durationSec, a.distanceKm) }}</span> /km</dd></div>
          </dl>
        </div>
      </section>

      <div class="dgrid">
        <div class="flow">
          <!-- 1 · La séance -->
          <section class="step" :class="{ filled: filled[0], next: filled[0] }" aria-labelledby="s1">
            <span class="mark" aria-hidden="true"><Check v-if="filled[0]" :size="15" /><span v-else>1</span></span>
            <h2 id="s1" class="step-title"><span class="sr-only">Étape 1 : </span>La séance</h2>
            <div class="card card--pad step-body s-seance">
              <div class="s-plan">
                <template v-if="session">
                  <p class="plan-eyebrow">
                    <span class="eyebrow">Prévu</span>
                    <span v-if="session.provider" class="provider">{{ session.provider }}</span>
                    <span v-else-if="session.synthetic" class="provider">D’après ta montre</span>
                  </p>
                  <p class="plan-title">{{ session.title }}</p>
                  <p v-if="sessionSteps.length" class="label">{{ stepsSummary(sessionSteps) }}</p>
                  <PlanVsDone :steps="result?.steps?.length ? result.steps : null" :blocks="session.blocks" />
                  <p v-if="resultBig" class="big-result">
                    <span class="num">{{ resultBig.n }}</span> <span class="rest">{{ resultBig.rest }}</span>
                  </p>
                </template>
                <template v-else>
                  <p class="plan-eyebrow"><span class="eyebrow">Séance libre</span></p>
                  <p class="plan-title">Hors plan</p>
                  <p class="fine">Aucune séance prévue n’est reliée à cette course.</p>
                </template>

                <button
                  type="button"
                  class="link swap"
                  :aria-expanded="choosing"
                  aria-controls="plan-choices"
                  @click="choosing = !choosing"
                >
                  <CalendarClock :size="16" aria-hidden="true" />
                  {{ session ? 'Ce n’était pas cette séance' : 'Choisir la séance prévue' }}
                  <ChevronDown :size="16" :class="{ up: choosing }" aria-hidden="true" />
                </button>
                <fieldset v-show="choosing" id="plan-choices" class="choices">
                  <legend class="sr-only">Séance prévue de cette course</legend>
                  <label v-for="s in nearby" :key="s.id" class="choice">
                    <input class="radio" type="radio" name="plan" :value="s.id" :checked="chosenPlan === s.id" @change="choosePlan(s.id)">
                    <span class="row__main">
                      <span class="title">{{ s.title }}</span>
                      <span class="label">{{ formatDay(`${s.date}T12:00:00Z`) }}</span>
                    </span>
                  </label>
                  <label class="choice">
                    <input class="radio" type="radio" name="plan" value="none" :checked="chosenPlan === 'none'" @change="choosePlan('none')">
                    <span class="row__main"><span class="title">Séance libre (hors plan)</span></span>
                  </label>
                </fieldset>
              </div>

              <div class="s-outcome">
                <p class="sub-title">Issue</p>
                <OutcomePicker v-model="outcome" />
                <p class="fine">{{ result ? 'Proposé d’après tes tours. Change-le si ça ne correspond pas.' : 'Rien à comparer : « Faite » par défaut. Change-le si besoin.' }}</p>

                <p class="sub-title">Type de séance</p>
                <div class="types" role="group" aria-label="Type de séance">
                  <button
                    v-for="t in TYPES"
                    :key="t"
                    type="button"
                    class="pill"
                    :style="{ '--c': RUN_TYPES[t].color }"
                    :aria-pressed="a.type === t"
                    @click="chooseType(t)"
                  >
                    <span class="dot" aria-hidden="true" />{{ RUN_TYPES[t].label }}
                  </button>
                </div>
              </div>
            </div>
          </section>

          <!-- 2 · Ton ressenti -->
          <section class="step" :class="{ filled: filled[1] }" aria-labelledby="s2">
            <span class="mark" aria-hidden="true"><Check v-if="filled[1]" :size="15" /><span v-else>2</span></span>
            <h2 id="s2" class="step-title"><span class="sr-only">Étape 2 : </span>Ton ressenti</h2>
            <div class="card card--pad step-body s-feel">
              <RpeScale v-model="rpe" />
              <div class="note-wrap">
                <label for="note" class="sub-title">Quelques mots sur ta séance (facultatif)</label>
                <textarea
                  id="note"
                  ref="noteField"
                  v-model="note"
                  class="note"
                  rows="2"
                  :maxlength="MAX_NOTE"
                  placeholder="Jambes, sensations, conditions…"
                  @input="fit"
                />
                <span class="count label" aria-live="polite">{{ note.length }}/{{ MAX_NOTE }}</span>
              </div>
            </div>
          </section>

          <!-- 3 · L'analyse -->
          <section class="step" :class="{ filled: filled[2] }" aria-labelledby="s3">
            <span class="mark" aria-hidden="true"><Check v-if="filled[2]" :size="15" /><span v-else>3</span></span>
            <h2 id="s3" class="step-title"><span class="sr-only">Étape 3 : </span>L’analyse</h2>
            <div class="card card--pad step-body s-ai">
              <template v-if="aiState === 'loading'">
                <p class="thinking"><Sparkles :size="18" aria-hidden="true" /> Analyse en cours…</p>
              </template>
              <template v-else-if="analysis">
                <p class="verdict">{{ analysis.verdict }}</p>
                <ul class="findings">
                  <li v-for="f in analysis.findings" :key="f.title" class="finding">
                    <span class="tile" :style="{ '--tile': FINDING[f.kind]?.color ?? 'var(--accent-text)' }" aria-hidden="true">
                      <component :is="FINDING[f.kind]?.icon ?? Lightbulb" :size="20" />
                    </span>
                    <span class="row__main">
                      <span class="title">{{ f.title }}</span>
                      <span class="f-text">{{ f.text }}</span>
                    </span>
                  </li>
                </ul>
              </template>
              <template v-else-if="aiConnected">
                <p class="fine">L’IA lit tes tours, ta séance prévue et ton ressenti, puis te dit ce qui a marché.</p>
              </template>

              <p v-if="aiState === 'error'" class="err" role="alert">{{ aiErr }}</p>

              <template v-if="aiConnected">
                <button v-if="!analysis && aiState !== 'loading'" type="button" class="btn btn--secondary ai-go" @click="runAnalysis">
                  <Sparkles :size="18" aria-hidden="true" /> {{ aiState === 'error' ? 'Réessayer' : 'Analyser ma séance' }}
                </button>
                <button v-else-if="analysis && aiState !== 'loading'" type="button" class="link relaunch" @click="runAnalysis">
                  <RefreshCw :size="16" aria-hidden="true" /> {{ aiState === 'error' ? 'Réessayer' : 'Relancer' }}
                </button>
                <div class="share">
                  <span class="row__main">
                    <span class="title">Tenir compte de ma note</span>
                    <span class="fine">Ta note est envoyée à {{ aiLabel }} avec les chiffres de la séance.</span>
                  </span>
                  <ToggleSwitch v-model="settings.ai.shareNote" label="Tenir compte de ma note" />
                </div>
              </template>
              <NuxtLink v-else :to="aiReturn" class="invite">
                <span class="spark" aria-hidden="true"><Sparkles :size="18" /></span>
                <span class="row__main">
                  <span class="title">Active l’IA pour une lecture de ta séance.</span>
                  <span class="fine">C’est gratuit avec Gemini. Tu peux publier sans analyse.</span>
                </span>
                <ArrowRight :size="18" aria-hidden="true" />
              </NuxtLink>
            </div>
          </section>

          <!-- 4 · Le titre -->
          <section class="step" :class="{ filled: filled[3] }" aria-labelledby="s4">
            <span class="mark" aria-hidden="true"><Check v-if="filled[3]" :size="15" /><span v-else>4</span></span>
            <h2 id="s4" class="step-title"><span class="sr-only">Étape 4 : </span>Le titre</h2>
            <div class="card card--pad step-body s-title">
              <div class="t-main">
                <div v-if="convention.enabled.value" class="sources" role="group" aria-label="Source de la séance">
                  <button
                    v-for="s in convention.sources.value"
                    :key="s"
                    type="button"
                    class="pill pill--tag"
                    :aria-pressed="source === s"
                    @click="source = s"
                  >
                    {{ s }}
                  </button>
                  <button type="button" class="pill pill--tag" :aria-pressed="source === ''" @click="source = ''">Aucune</button>
                  <button type="button" class="pill pill--tag pill--fail" :aria-pressed="fail" @click="fail = !fail">{{ failTag }}</button>
                </div>
                <label for="title-field" class="sr-only">Titre de la séance</label>
                <input
                  id="title-field"
                  v-model="titlePart"
                  class="t-field"
                  type="text"
                  :maxlength="TITLE_MAX"
                  autocomplete="off"
                  enterkeyhint="done"
                  placeholder="Titre de ta séance"
                >
                <p class="t-final" aria-live="polite"><span class="sr-only">Titre complet : </span>{{ finalTitle || '…' }}</p>
              </div>
              <div class="t-ideas">
                <p class="sub-title">Propositions</p>
                <div class="props">
                  <button v-for="p in proposals" :key="p.label" type="button" class="prop" :class="{ on: titlePart === p.text }" @click="titlePart = p.text">
                    <span class="prop-k">{{ p.label }}</span>
                    <span class="prop-v">{{ p.text }}</span>
                  </button>
                  <button v-for="t in ideas" :key="t" type="button" class="prop prop--ai" :class="{ on: titlePart === t }" @click="titlePart = t">
                    <span class="prop-k">Idée de l’IA</span>
                    <span class="prop-v">{{ t }}</span>
                  </button>
                </div>
                <template v-if="aiConnected">
                  <div v-if="ideasLoaded" class="segmented styles" role="group" aria-label="Style des idées">
                    <button v-for="s in TITLE_STYLES" :key="s.id" type="button" :aria-pressed="style === s.id" :disabled="ideasState === 'loading'" @click="pickStyle(s.id)">{{ s.label }}</button>
                  </div>
                  <p v-if="ideasState === 'error'" class="err" role="alert">{{ ideasErr }}</p>
                  <button type="button" class="link ideas-go" :disabled="ideasState === 'loading'" @click="loadIdeas">
                    <Sparkles :size="16" aria-hidden="true" />
                    {{ ideasState === 'loading' ? 'Recherche d’idées…' : ideasState === 'error' ? 'Réessayer' : ideasLoaded ? 'Trois autres idées' : 'Idées de l’IA' }}
                  </button>
                </template>
              </div>
            </div>
          </section>
        </div>

        <!-- 5 · Sur Strava -->
        <aside class="side">
          <section class="step step--last" :class="{ filled: filled[4] }" aria-labelledby="s5">
            <span class="mark" aria-hidden="true"><Check v-if="filled[4]" :size="15" /><span v-else>5</span></span>
            <h2 id="s5" class="step-title"><span class="sr-only">Étape 5 : </span>Sur Strava</h2>
            <article class="post" aria-label="Aperçu de la publication sur Strava">
              <header class="post-head">
                <BrandMark brand="strava" :size="30" />
                <span class="row__main">
                  <span class="post-who">Ta course</span>
                  <span class="label">{{ dateLine }}</span>
                </span>
                <span v-if="upToDate" class="chip chip--ok">Publié</span>
              </header>
              <p class="post-title">{{ finalTitle || 'Sans titre' }}</p>
              <div class="post-body">
                <p v-if="descState === 'loading'" class="fine">Lecture de ta description…</p>
                <p v-else-if="descState === 'error'" class="fine">Impossible de relire ta description pour l’instant : ton texte sera quand même gardé tel quel.</p>
                <div v-else-if="userText" class="mine">
                  <p class="part-k">Ton texte, inchangé</p>
                  <p class="mine-text">{{ userText }}</p>
                </div>
                <div v-if="block" class="added">
                  <p class="part-k">Ajouté par l’appli</p>
                  <p class="added-text">{{ block }}</p>
                </div>
                <p v-else class="fine">Rien n’est ajouté à ta description : seul le titre change.</p>
              </div>
              <div class="post-stats" aria-hidden="true">
                <span><span class="label">Distance</span><span class="num">{{ formatKm(a.distanceKm) }} km</span></span>
                <span><span class="label">Allure</span><span class="num">{{ formatPace(a.durationSec, a.distanceKm) }} /km</span></span>
                <span><span class="label">Temps</span><span class="num">{{ formatDuration(a.durationSec) }}</span></span>
              </div>
            </article>
            <div class="parts" role="group" aria-label="Ce que l’appli ajoute">
              <button v-for="p in PARTS" :key="p.key" type="button" class="pill" :aria-pressed="parts[p.key]" @click="togglePart(p.key)">
                <Check v-if="parts[p.key]" :size="14" aria-hidden="true" />{{ p.label }}
              </button>
            </div>
            <p v-if="overflow" class="err" role="alert">Ta description Strava est trop longue pour y ajouter ce texte. Coupe des parties, ou raccourcis-la sur Strava.</p>

            <button type="button" class="btn btn--primary side-publish" :disabled="!canPublish" @click="publish">
              {{ publishLabel }}
              <component :is="upToDate ? Check : ArrowRight" :size="20" aria-hidden="true" />
            </button>
            <div class="others">
              <button type="button" class="link" @click="keepPrivate">Enregistrer sans publier</button>
              <button type="button" class="link quiet" @click="noDebrief">Ne pas débriefer cette course</button>
            </div>
          </section>
        </aside>
      </div>

      <!-- Barre d'action (téléphone et tablette) -->
      <div class="actionbar">
        <NuxtLink :to="courseLink" class="btn btn--secondary later"><Clock :size="18" aria-hidden="true" /> Plus tard</NuxtLink>
        <button type="button" class="btn btn--primary" :disabled="!canPublish" @click="publish">
          {{ publishLabel }}
          <component :is="upToDate ? Check : ArrowRight" :size="20" aria-hidden="true" />
        </button>
      </div>

      <Teleport to="body">
        <Transition name="done">
          <div v-if="success" class="success" role="status" aria-live="assertive">
            <span class="tick" aria-hidden="true">
              <svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="24" /><path d="M15 27l7 7 15-16" /></svg>
            </span>
            <p class="h2">{{ demo ? 'Débrief publié (démo)' : 'Débrief publié sur Strava' }}</p>
          </div>
        </Transition>
      </Teleport>
    </template>
  </div>
</template>

<style scoped>
.debrief {
  --rail: 40px;
  gap: 18px;
}

/* ── En-tête ── */
.dh {
  display: flex;
  align-items: center;
  gap: 14px;
}

.close {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  border-radius: var(--r-knob);
  color: var(--ink);
  background: var(--surface-2);
  border: 1px solid var(--surface-border);
  transition: transform 0.15s var(--ease-spring);
}

.close:active {
  transform: scale(0.92);
}

.dh-title {
  flex: 1;
  min-width: 0;
}

.dh-title .eyebrow {
  color: var(--accent-text);
}

.progress {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
}

.segs {
  display: flex;
  gap: 3px;
}

.segs span {
  width: 12px;
  height: 4px;
  border-radius: 2px;
  background: var(--line-strong);
  transition: background 0.3s ease;
}

.segs span.on {
  background: var(--accent-text);
}

/* ── Rappel de la course ── */
.recap {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 16px 12px 12px;
}

.thumb {
  flex-shrink: 0;
  width: 64px;
  height: 64px;
  padding: 8px;
  border-radius: var(--r-ctrl);
  background:
    radial-gradient(circle at 30% 20%, color-mix(in srgb, var(--c) 22%, transparent), transparent 70%),
    var(--surface-2);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--c) 25%, transparent);
}

.recap-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.recap-title {
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 17px;
}

.recap-nums {
  display: flex;
  gap: 14px;
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--muted);
}

.recap-nums dd {
  margin: 0;
}

.recap-nums .num {
  font-size: 17px;
  color: var(--ink);
}

/* ── Le fil : cinq temps reliés ── */
.dgrid {
  display: flex;
  flex-direction: column;
}

.flow {
  display: flex;
  flex-direction: column;
}

.step {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 0 0 26px var(--rail);
  animation: rise 0.5s var(--ease-out) backwards;
}

.flow .step:nth-child(2) { animation-delay: 60ms; }
.flow .step:nth-child(3) { animation-delay: 120ms; }
.flow .step:nth-child(4) { animation-delay: 180ms; }
.side .step { animation-delay: 240ms; }

/* Le fil : du repère de cette étape jusqu'au suivant ; parcouru, il prend l'accent */
.step::before {
  content: '';
  position: absolute;
  top: 34px;
  bottom: -2px;
  left: 14px;
  width: 2px;
  border-radius: 1px;
  background: var(--line-strong);
  transition: background 0.4s ease;
}

.step.filled::before {
  background: linear-gradient(180deg, var(--accent-text), color-mix(in srgb, var(--accent-text) 30%, var(--line-strong)));
}

.step--last::before {
  display: none;
}

.mark {
  position: absolute;
  top: 0;
  left: 0;
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: var(--r-knob);
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 700;
  color: var(--muted);
  background: var(--bg);
  box-shadow: inset 0 0 0 2px var(--line-strong);
  transition: background 0.3s ease, color 0.3s ease, box-shadow 0.3s ease;
}

.step.filled .mark {
  color: var(--on-select);
  background: var(--accent-text);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent-text) 22%, transparent), 0 0 18px -2px var(--accent-text);
  animation: pop 0.45s var(--ease-spring);
}

.step-title {
  display: flex;
  align-items: center;
  min-height: 30px;
  margin: 0;
  font-family: var(--font-display);
  font-weight: var(--display-weight);
  font-size: 21px;
  letter-spacing: var(--tracking-display);
  line-height: 1.1;
}

.step-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.step-body.card--pad {
  padding: 18px 16px;
}

.sub-title {
  margin: 0;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--muted);
}

.fine {
  margin: 0;
}

.err {
  margin: 0;
  color: var(--ko);
  font-weight: 600;
  font-size: 15px;
}

/* ── 1 · La séance ── */
.s-plan,
.s-outcome {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}

.plan-eyebrow {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
}

.plan-eyebrow .eyebrow {
  color: var(--accent-text);
}

.provider {
  padding: 2px 8px;
  border-radius: var(--r-pill);
  font-size: 11px;
  font-weight: 700;
  color: var(--ink-2);
  background: var(--surface-2);
}

.plan-title {
  margin: -4px 0 0;
  font-family: var(--font-display);
  font-weight: var(--display-weight);
  font-size: 26px;
  line-height: 1.08;
  letter-spacing: var(--tracking-display);
}

.big-result {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin: 4px 0 0;
}

.big-result .num {
  font-size: 44px;
}

.big-result .rest {
  font-family: var(--font-display);
  font-weight: var(--title-weight);
  font-size: 18px;
  color: var(--ink-2);
}

.swap {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  align-self: flex-start;
  min-height: 44px;
  padding: 0;
}

.swap .up {
  transform: rotate(180deg);
}

.choices {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 4px 0;
  border: 0;
  border-top: 1px solid var(--line);
  min-width: 0;
}

.choice {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 52px;
  padding: 6px 0;
  cursor: pointer;
}

.choice + .choice {
  border-top: 1px solid var(--line);
}

.s-outcome .sub-title:not(:first-child) {
  margin-top: 8px;
}

.types,
.sources,
.parts {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.pill {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: 40px;
  padding: 0 14px;
  border: 1px solid var(--line-strong);
  border-radius: var(--r-pill);
  background: transparent;
  color: var(--ink-2);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease, transform 0.12s ease;
}

/* Zone tactile de 44 px autour d'une pastille de 40 px */
.pill {
  position: relative;
}

.pill::after {
  content: '';
  position: absolute;
  inset: -2px;
}

.pill:active {
  transform: scale(0.96);
}

.pill .dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--c);
}

.pill[aria-pressed='true'] {
  border-color: transparent;
  background: var(--select);
  color: var(--on-select);
}

.types .pill[aria-pressed='true'] {
  background: color-mix(in srgb, var(--c) 20%, transparent);
  border-color: var(--c);
  color: var(--ink);
}

.pill--tag {
  font-family: var(--font-mono);
  font-size: 13px;
  letter-spacing: 0.04em;
}

.pill--fail[aria-pressed='true'] {
  background: var(--ko);
  color: var(--bg);
}

/* ── 2 · Ressenti ── */
.note-wrap {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.note {
  width: 100%;
  min-height: 64px;
  padding: 12px 14px;
  border: 1px solid var(--line-strong);
  border-radius: var(--r-ctrl);
  background: color-mix(in srgb, var(--bg) 40%, transparent);
  color: var(--ink);
  font: inherit;
  font-size: 16px;
  line-height: 1.45;
  resize: none;
  overflow: hidden;
  outline: none;
  transition: border-color 0.2s ease;
}

.note:focus {
  border-color: var(--focus);
}

.note::placeholder {
  color: var(--muted);
}

.count {
  align-self: flex-end;
  font-size: 12px;
}

/* ── 3 · Analyse ── */
.thinking {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--accent-text);
  font-weight: 600;
  animation: breathe 1.1s ease-in-out infinite alternate;
}

@keyframes breathe {
  to {
    opacity: 0.45;
  }
}

.verdict {
  margin: 0;
  font-family: var(--font-display);
  font-weight: var(--title-weight);
  font-size: 19px;
  line-height: 1.3;
}

.findings {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.finding {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.finding .title {
  white-space: normal;
}

.f-text {
  font-size: 15px;
  color: var(--ink-2);
}

.ai-go {
  min-height: 52px;
}

.ai-go svg {
  color: var(--accent-text);
}

.relaunch,
.ideas-go {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  align-self: flex-start;
  min-height: 44px;
  padding: 0;
}

.share {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-top: 14px;
  border-top: 1px solid var(--line);
}

.invite {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 56px;
  color: var(--ink);
}

.invite .title {
  white-space: normal;
}

.invite > svg {
  flex-shrink: 0;
  color: var(--accent-text);
}

.spark {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: var(--r-ctrl);
  color: var(--on-primary);
  background: var(--primary);
}

/* ── 4 · Titre ── */
.t-main,
.t-ideas {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}

.t-field {
  width: 100%;
  min-height: 52px;
  padding: 4px 0;
  border: 0;
  border-bottom: 2px solid var(--line-strong);
  border-radius: 0;
  background: transparent;
  color: var(--ink);
  font-family: var(--font-display);
  font-weight: var(--title-weight);
  font-size: 22px;
  outline: none;
  transition: border-color 0.2s ease;
}

.t-field:focus {
  border-bottom-color: var(--focus);
}

.t-final {
  margin: 0;
  padding: 8px 10px;
  border-radius: var(--r-ctrl);
  background: var(--surface-2);
  font-family: var(--font-mono);
  font-size: 13px;
  color: var(--ink-2);
  overflow-wrap: anywhere;
}

.props {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.prop {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1px;
  min-height: 52px;
  padding: 8px 12px;
  border: 1px solid var(--line);
  border-radius: var(--r-ctrl);
  background: transparent;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.2s ease, background 0.2s ease;
}

.prop.on {
  border-color: var(--accent-text);
  background: color-mix(in srgb, var(--accent-text) 10%, transparent);
}

.prop-k {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
}

.prop--ai .prop-k {
  color: var(--accent-text);
}

.prop-v {
  font-weight: 600;
  color: var(--ink);
}

.styles {
  margin-top: 2px;
}

/* ── 5 · Sur Strava : une vraie carte de publication ── */
.post {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 16px 14px;
  border-radius: var(--r-card);
  border: 1px solid var(--surface-border);
  background: var(--surface);
  box-shadow: var(--surface-shadow), inset 0 3px 0 var(--strava);
  overflow: hidden;
}

.post::after {
  content: '';
  position: absolute;
  inset: 0 0 auto;
  height: 90px;
  background: radial-gradient(70% 100% at 0% 0%, color-mix(in srgb, var(--strava) 16%, transparent), transparent 70%);
  pointer-events: none;
}

.post > * {
  position: relative;
  z-index: 1;
}

.post-head {
  display: flex;
  align-items: center;
  gap: 10px;
}

.post-who {
  font-weight: 700;
  font-size: 14px;
}

.post-title {
  margin: 0;
  font-family: var(--font-display);
  font-weight: var(--display-weight);
  font-size: 22px;
  line-height: 1.15;
  letter-spacing: var(--tracking-display);
  overflow-wrap: anywhere;
}

.post-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.part-k {
  margin: 0 0 4px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--muted);
}

.mine-text {
  margin: 0;
  white-space: pre-line;
  overflow-wrap: anywhere;
  line-height: 1.5;
}

.added {
  padding-left: 12px;
  border-left: 2px solid var(--strava);
}

.added .part-k {
  color: var(--strava);
}

.added-text {
  margin: 0;
  white-space: pre-line;
  overflow-wrap: anywhere;
  font-size: 14px;
  line-height: 1.55;
  color: var(--ink-2);
}

.post-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid var(--line);
}

.post-stats > span {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.post-stats .label {
  font-size: 11px;
}

.post-stats .num {
  font-size: 16px;
}

.parts .pill svg {
  margin-left: -3px;
}

.others {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 4px 16px;
}

.others .link {
  min-height: 44px;
}

.others .quiet {
  color: var(--muted);
  font-weight: 500;
}

.side-publish {
  display: none;
}

/* ── Barre d'action collée en bas ── */
.actionbar {
  position: fixed;
  z-index: 20;
  left: 50%;
  bottom: 0;
  transform: translateX(-50%);
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 10px;
  width: min(100%, 480px);
  padding: 12px 16px calc(env(safe-area-inset-bottom) + 12px);
  background: linear-gradient(180deg, transparent, color-mix(in srgb, var(--bg) 88%, transparent) 26%, var(--bg));
  animation: none;
}

.later {
  width: auto;
  padding: 0 16px;
  gap: 8px;
}

.later svg {
  color: var(--muted);
}

/* ── Confirmation ── */
.success {
  position: fixed;
  z-index: 50;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 18px;
  background: color-mix(in srgb, var(--bg) 86%, transparent);
  -webkit-backdrop-filter: blur(10px);
  backdrop-filter: blur(10px);
  color: var(--ink);
}

.tick {
  width: 96px;
  height: 96px;
  animation: pop 0.5s var(--ease-spring);
}

.tick svg {
  width: 100%;
  height: 100%;
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.tick circle {
  stroke: var(--ok);
  stroke-width: 2.5;
  fill: color-mix(in srgb, var(--ok) 14%, transparent);
  stroke-dasharray: 151;
  stroke-dashoffset: 151;
  animation: draw 0.55s var(--ease-out) forwards;
}

.tick path {
  stroke: var(--ok);
  stroke-width: 4;
  stroke-dasharray: 36;
  stroke-dashoffset: 36;
  animation: draw 0.35s var(--ease-out) 0.4s forwards;
}

@keyframes draw {
  to {
    stroke-dashoffset: 0;
  }
}

.done-enter-active {
  transition: opacity 0.25s ease;
}

.done-enter-from {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .tick circle,
  .tick path {
    stroke-dashoffset: 0;
  }
}

/* ── Tablette : contenu élargi, chaque carte sur deux colonnes quand ça respire mieux ── */
@media (min-width: 720px) {
  .debrief {
    max-width: 780px;
    margin-inline: auto;
  }

  .actionbar {
    width: min(100%, 780px);
    padding-inline: 32px;
  }

  .s-seance,
  .s-feel,
  .s-title {
    display: grid;
    grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
    gap: 24px;
    align-items: start;
  }

  .s-feel .note-wrap {
    padding-top: 6px;
  }
}

/* ── Ordinateur : les étapes à gauche, l'aperçu et les boutons à droite (collés en haut) ── */
@media (min-width: 1080px) {
  .debrief {
    max-width: none;
  }

  .dgrid {
    display: grid;
    grid-template-columns: minmax(0, 1.5fr) minmax(340px, 1fr);
    gap: 36px;
    align-items: start;
  }

  /* La colonne de gauche est plus étroite qu'une tablette : retour à une seule colonne par carte */
  .s-seance,
  .s-feel,
  .s-title {
    display: flex;
    align-items: stretch;
  }

  .s-feel .rpe,
  .s-feel .note-wrap,
  .s-title .t-main {
    max-width: 560px;
  }

  .flow .step:last-child {
    padding-bottom: 0;
  }

  .flow .step:last-child::before {
    display: none;
  }

  .side {
    position: sticky;
    top: 24px;
  }

  .side .step {
    padding-bottom: 0;
  }

  .side-publish {
    display: inline-flex;
  }

  .actionbar {
    display: none;
  }
}
</style>
