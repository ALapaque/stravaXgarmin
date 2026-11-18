<script setup lang="ts">
import { RefreshCw, ArrowRight } from 'lucide-vue-next'
import type { TitleStyle } from '~/composables/useAi'
import type { ChangeSource } from '~/composables/useActivities'

const route = useRoute()
const router = useRouter()
const { byId, setStravaName, setGarminName } = useActivities()
const { accounts } = useAccounts()
const settings = useSettings()
const alsoGarmin = computed(() => Boolean(settings.value.garmin.rename && accounts.value.garmin.connected && a.value?.garminId))
const publishing = ref(false)
const { suggestTitles } = useAi()
const { show } = useToast()
const { ruleTitle } = useNaming()
const { recordTitle } = useRecords()
const { entries, undo } = useHistory()
const { notify } = useNotifications()

const a = computed(() => byId(String(route.params.id)))
if (!a.value) throw createError({ statusCode: 404, statusMessage: 'Activité introuvable' })

useHead({ title: 'Titre · stravaXgarmin' })

const style = ref<TitleStyle>('epique')
const round = ref(0)
const ideas = ref<string[]>([])
const chosen = ref('')
const loading = ref(false)

// Titre saisi à la main, sélectionné comme une idée de plus
const CUSTOM = '__custom__'
const MAX = 100
const custom = ref('')
const field = ref<HTMLInputElement>()
const finalTitle = computed(() => (chosen.value === CUSTOM ? custom.value.trim() : chosen.value))

/** Titres proposés sans IA : le record battu, puis la règle de nommage du type */
const special = computed(() => {
  if (!a.value) return []
  const list: { title: string; tag: string; source: ChangeSource }[] = []
  const rec = recordTitle(a.value)
  if (rec) list.push({ title: rec, tag: 'Record', source: 'record' })
  list.push({ title: ruleTitle(a.value), tag: 'Ta règle', source: 'regle' })
  return list
})
const aiIdeas = computed(() => ideas.value.filter((t) => !special.value.some((s) => s.title === t)))

function sourceOf(title: string): ChangeSource {
  if (chosen.value === CUSTOM) return 'manuel'
  return special.value.find((s) => s.title === title)?.source ?? 'ia'
}

function pickCustom() {
  chosen.value = CUSTOM
  field.value?.focus()
}

const { connected: aiConnected } = useChatGpt()

async function load() {
  if (!a.value) return
  // Aucune proposition IA sans compte ChatGPT connecté
  if (!aiConnected.value) {
    ideas.value = []
    if (chosen.value !== CUSTOM && !special.value.some((s) => s.title === chosen.value)) chosen.value = special.value[0]?.title ?? ''
    return
  }
  loading.value = true
  ideas.value = await suggestTitles(a.value, style.value, round.value)
  const all = [...special.value.map((s) => s.title), ...ideas.value]
  if (chosen.value !== CUSTOM && !all.includes(chosen.value)) chosen.value = all[0] ?? ''
  loading.value = false
}

watch(aiConnected, () => load())

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
  if (!a.value || !finalTitle.value) return
  const title = finalTitle.value
  publishing.value = true
  const ok = await setStravaName(a.value.id, title, sourceOf(title))
  if (ok && alsoGarmin.value) await setGarminName(a.value.id, title, sourceOf(title))
  publishing.value = false
  if (!ok) return
  show(alsoGarmin.value ? 'Titre publié sur Strava et Garmin' : 'Titre publié sur Strava', {
    label: 'Annuler',
    run: async () => {
      const last = entries.value[0]
      if (last && (await undo(last.id))) show('Ancien titre remis sur Strava')
    },
  })
  notify({ kind: 'titles', title: 'Titre publié sur Strava', body: title, to: `/activites/${a.value.id}` })
  await router.push(`/activites/${a.value.id}`)
}
</script>

<template>
  <div class="stack">
    <template v-if="a">
      <BackLink :to="`/activites/${a.id}`" :label="a.garminName" />

      <div class="title-block">
        <h1 class="h1">Un titre pour {{ formatDay(a.startedAt).split(' ')[0]!.toLowerCase() }}</h1>
        <p class="label">
          {{ formatKm(a.distanceKm) }} km · {{ formatDuration(a.durationSec) }} · {{ formatPace(a.durationSec, a.distanceKm) }} /km
        </p>
      </div>

      <fieldset class="card list ideas" :aria-busy="loading">
        <legend class="sr">Choisis un titre</legend>
        <label v-for="s in special" :key="s.tag" class="row">
          <span class="row__main">
            <span class="tag" :class="`tag--${s.source}`">{{ s.tag }}</span>
            <span class="title">{{ s.title }}</span>
          </span>
          <input v-model="chosen" class="radio" type="radio" name="title" :value="s.title">
        </label>
        <div class="row custom" :class="{ on: chosen === CUSTOM }" @click="pickCustom">
          <span class="row__main">
            <label for="custom-title" class="label">Mon propre titre</label>
            <input
              id="custom-title"
              ref="field"
              v-model="custom"
              class="field"
              type="text"
              :maxlength="MAX"
              :placeholder="a.garminName"
              autocomplete="off"
              enterkeyhint="done"
              @focus="chosen = CUSTOM"
              @keydown.enter.prevent="publish"
            >
            <span v-if="chosen === CUSTOM" class="count label" aria-live="polite">{{ custom.length }}/{{ MAX }}</span>
          </span>
          <input
            v-model="chosen"
            class="radio"
            type="radio"
            name="title"
            :value="CUSTOM"
            aria-label="Utiliser mon propre titre"
            @click.stop
            @change="field?.focus()"
          >
        </div>
      </fieldset>

      <section class="ai" aria-labelledby="ai-title">
        <div class="ai-head">
          <h2 id="ai-title" class="h2">Idées IA</h2>
          <span class="label via">via ChatGPT</span>
        </div>
        <AiLock text="Connecte ton compte ChatGPT pour recevoir trois idées de titre par course.">
          <template #default="{ locked }">
            <div class="ai-body">
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
                <legend class="sr">Idées de titres proposées par l’IA</legend>
                <!-- Sans connexion : des lignes d'exemple floutées, aucune vraie proposition -->
                <template v-if="locked">
                  <div v-for="n in 3" :key="n" class="row"><span class="row__main"><span class="title">Titre proposé par l’IA</span></span><span class="radio" /></div>
                </template>
                <label v-for="t in aiIdeas" v-else :key="t" class="row">
                  <span class="row__main"><span class="title">{{ t }}</span></span>
                  <input v-model="chosen" class="radio" type="radio" name="title" :value="t">
                </label>
              </fieldset>
              <button v-if="!locked" type="button" class="link more" @click="more">
                <RefreshCw :size="18" aria-hidden="true" /> Trois autres idées
              </button>
            </div>
          </template>
        </AiLock>
      </section>

      <button type="button" class="btn btn--primary" :disabled="!finalTitle || publishing" @click="publish">
        {{ publishing ? 'Publication…' : alsoGarmin ? 'Publier sur Strava et Garmin' : 'Publier sur Strava' }}
        <ArrowRight :size="20" aria-hidden="true" />
      </button>

    </template>
  </div>
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

.tag {
  align-self: flex-start;
  margin-bottom: 2px;
  padding: 2px 8px;
  border-radius: 99px;
  font-size: 12px;
  font-weight: 700;
  color: var(--accent-text);
  background: color-mix(in srgb, var(--accent-text) 15%, transparent);
}

.tag--record {
  color: var(--ok);
  background: color-mix(in srgb, var(--ok) 15%, transparent);
}

.custom {
  align-items: center;
  cursor: text;
}

.custom .label {
  cursor: text;
}

.field {
  width: 100%;
  min-height: 36px;
  margin-top: 2px;
  padding: 4px 0;
  border: 0;
  border-bottom: 1px solid var(--line-strong);
  border-radius: 0;
  background: transparent;
  color: var(--ink);
  font: inherit;
  font-size: 16px;
  font-weight: var(--title-weight);
  outline: none;
  transition: border-color 0.2s ease;
}

.field::placeholder {
  color: var(--muted);
  font-weight: 400;
}

.custom.on .field,
.field:focus {
  border-bottom-color: var(--focus);
}

.count {
  align-self: flex-end;
  font-size: 13px;
}

.sr {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}

.ai {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ai-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.ai-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
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
