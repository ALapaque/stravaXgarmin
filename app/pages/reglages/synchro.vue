<script setup lang="ts">
/*
 * Réglages · Titres et publication : synchro automatique, convention de titres « [SOURCE] - Titre »
 * (automatique, toujours, jamais ; sources ; étiquette d'échec ; exemple en direct), ce que le Débrief
 * publie sous ta description Strava, règles de nommage et historique des modifications.
 */
import { ChevronRight, History, Plus, Type, X } from 'lucide-vue-next'
import { formatTitle } from '#shared/utils/titles'

useHead({ title: 'Titres et publication · stravaXgarmin' })

const settings = useSettings()
const { entries } = useHistory()
const convention = useConvention()

/* ───── Convention de titres ───── */
const MODES = [
  { id: 'auto', label: 'Automatique' },
  { id: 'on', label: 'Toujours' },
  { id: 'off', label: 'Jamais' },
] as const
const modeHint = computed(() => {
  const m = settings.value.tags.mode
  if (m === 'on') return 'Chaque titre publié par le Débrief commence par sa source.'
  if (m === 'off') return 'Tes titres restent sans étiquette.'
  return convention.detected.value.enabled
    ? 'Tes titres Strava suivent déjà cette convention : l’appli la garde.'
    : 'Tes titres Strava ne la suivent pas encore : l’appli ne l’impose pas.'
})

const cleanTag = (t: string) => t.replace(/[[\]]/g, '').trim().toUpperCase().slice(0, 24)
const mine = computed(() => new Set((settings.value.tags.sources ?? []).map(cleanTag)))
const newSource = ref('')
function addSource() {
  const t = cleanTag(newSource.value)
  newSource.value = ''
  if (!t || t === convention.failTag.value || mine.value.has(t)) return
  settings.value.tags.sources = [...(settings.value.tags.sources ?? []), t]
}
function removeSource(t: string) {
  settings.value.tags.sources = (settings.value.tags.sources ?? []).filter((s) => cleanTag(s) !== t)
}
const failInput = computed({
  get: () => settings.value.tags.fail ?? 'FAIL',
  set: (v: string) => (settings.value.tags.fail = cleanTag(v) || 'FAIL'),
})

/** Exemples en direct : une séance faite, une séance ratée */
const example = computed(() => {
  const source = convention.sources.value.find((s) => s !== 'CUSTOM' && s !== 'RACE') ?? 'KIPRUN'
  if (!convention.enabled.value) return { done: 'Footing 40’', failed: '5x400m(R=200m)' }
  return {
    done: formatTitle({ source, title: 'Footing 40’' }),
    failed: formatTitle({ source, title: '5x400m(R=200m)', failed: true, failTag: convention.failTag.value }),
  }
})

/* ───── Ce que le Débrief publie ───── */
const descriptionParts = [
  { key: 'note', label: 'Ma note', hint: 'Les mots que tu écris dans le débrief' },
  { key: 'feeling', label: 'Ressenti', hint: 'Ta note sur 10 et l’issue de la séance' },
  { key: 'analysis', label: 'Analyse', hint: 'Le verdict et les constats de l’IA' },
  { key: 'numbers', label: 'Chiffres', hint: 'Le temps de chaque effort, sinon de chaque kilomètre' },
  { key: 'shoes', label: 'Chaussures', hint: 'Modèle et kilométrage' },
  { key: 'signature', label: 'Signature', hint: '« — via stravaXgarmin »' },
] as const
</script>

<template>
  <div class="stack stack--wide">
    <BackLink to="/reglages" label="Réglages" />
    <div class="title-block">
      <h1 class="h1">Titres et publication</h1>
      <p class="lead">Comment tes courses sont nommées, et ce que le Débrief ajoute sur Strava.</p>
    </div>

    <div class="cols">
      <div class="col">
        <h2 class="eyebrow group">Synchronisation</h2>
        <div class="card list">
          <div class="row">
            <span class="row__main">
              <span class="title">Synchro automatique</span>
              <span class="hint">Dès qu’une course arrive</span>
            </span>
            <ToggleSwitch v-model="settings.autoSync" label="Synchro automatique" />
          </div>
          <div class="row">
            <span class="row__main">
              <span class="title">Écraser un nom Strava</span>
              <span class="hint">Même modifié à la main</span>
            </span>
            <ToggleSwitch v-model="settings.overwriteEdited" label="Écraser un nom Strava modifié" />
          </div>
          <NuxtLink to="/reglages/nommage" class="row">
            <span class="tile" aria-hidden="true"><Type :size="22" /></span>
            <span class="row__main">
              <span class="title">Règles de nommage</span>
              <span class="hint">{{ settings.naming.enabled ? 'Actives sur les noms génériques' : 'Désactivées' }}</span>
            </span>
            <ChevronRight class="go" :size="20" aria-hidden="true" />
          </NuxtLink>
          <NuxtLink to="/historique" class="row">
            <span class="tile" aria-hidden="true"><History :size="22" /></span>
            <span class="row__main">
              <span class="title">Historique des modifications</span>
              <span class="hint">{{ entries.length }} {{ entries.length > 1 ? 'changements' : 'changement' }}, annulables</span>
            </span>
            <ChevronRight class="go" :size="20" aria-hidden="true" />
          </NuxtLink>
        </div>

        <h2 id="conv-title" class="eyebrow group">Convention de titres</h2>
        <section class="card conv" aria-labelledby="conv-title">
          <!-- Exemple en direct -->
          <div class="example" aria-live="polite">
            <span class="label">Exemple</span>
            <code class="ex">{{ example.done }}</code>
            <code class="ex ex--fail">{{ example.failed }}</code>
          </div>

          <div class="block-in">
            <div class="segmented" role="group" aria-label="Étiquettes au début des titres">
              <button v-for="m in MODES" :key="m.id" type="button" :aria-pressed="settings.tags.mode === m.id" @click="settings.tags.mode = m.id">{{ m.label }}</button>
            </div>
            <p class="hint">{{ modeHint }}</p>
          </div>

          <div class="block-in">
            <p class="title">Sources</p>
            <ul class="sources">
              <li v-for="s in convention.sources.value" :key="s" class="src" :class="{ mine: mine.has(s) }">
                [{{ s }}]
                <button v-if="mine.has(s)" type="button" class="rm" :aria-label="`Retirer la source ${s}`" @click="removeSource(s)"><X :size="14" aria-hidden="true" /></button>
              </li>
            </ul>
            <form class="add" @submit.prevent="addSource">
              <label class="sr-only" for="new-source">Nouvelle source</label>
              <input id="new-source" v-model="newSource" class="field" type="text" maxlength="24" placeholder="ex. COACH" autocapitalize="characters" autocomplete="off">
              <button type="submit" class="btn btn--sm btn--secondary" :disabled="!newSource.trim()"><Plus :size="16" aria-hidden="true" /> Ajouter</button>
            </form>
            <p class="hint">Celles vues dans tes titres Strava sont proposées d’elles-mêmes, avec CUSTOM et RACE.</p>
          </div>

          <label class="block-in fail">
            <span class="row__main">
              <span class="title">Étiquette d’une séance ratée</span>
              <span class="hint">Ajoutée devant la source quand tu indiques « séance ratée » dans le débrief</span>
            </span>
            <input v-model.lazy="failInput" class="field field--short" type="text" maxlength="24" autocapitalize="characters" autocomplete="off">
          </label>
        </section>
      </div>

      <div class="col">
        <h2 class="eyebrow group">Ce que le débrief publie</h2>
        <div class="card list">
          <p class="row hint intro">Ce que le Débrief ajoute sous ton texte, sur Strava. Ton texte reste toujours tel quel.</p>
          <div v-for="p in descriptionParts" :key="p.key" class="row">
            <span class="row__main">
              <span class="title">{{ p.label }}</span>
              <span class="hint">{{ p.hint }}</span>
            </span>
            <ToggleSwitch v-model="settings.description[p.key]" :label="p.label" />
          </div>
          <div class="row">
            <span class="row__main">
              <span class="title">L’analyse tient compte de ma note</span>
              <span class="hint">Ta note est envoyée à l’IA avec les chiffres de la séance</span>
            </span>
            <ToggleSwitch v-model="settings.ai.shareNote" label="L’analyse tient compte de ma note" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.title-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.title-block .lead {
  margin: 0;
}

.group {
  margin-top: 4px;
  color: var(--accent-text);
}

.hint {
  margin: 0;
  font-size: 15px;
  color: var(--muted);
}

.row .tile {
  --tile: var(--accent-text);
}

/* Les libellés longs passent à la ligne plutôt que d'être coupés */
.row__main .title {
  white-space: normal;
}

.go {
  flex-shrink: 0;
  color: var(--muted);
}

.intro {
  min-height: 0;
  margin: 0;
}

/* ── Convention ── */
.conv {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.example {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  background: var(--surface-2);
  border-bottom: 1px solid var(--line);
}

.ex {
  font-family: var(--font-mono);
  font-size: 15px;
  font-weight: 700;
  color: var(--ink);
  overflow-wrap: anywhere;
  animation: rise 0.35s var(--ease-out);
}

.ex--fail {
  color: var(--ink-2);
}

.block-in {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px;
}

.block-in + .block-in {
  border-top: 1px solid var(--line);
}

.sources {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.src {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 36px;
  padding: 0 12px;
  border-radius: var(--r-pill);
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 700;
  color: var(--ink-2);
  background: var(--surface-2);
  border: 1px solid var(--line);
}

.src.mine {
  padding-right: 4px;
  color: var(--ink);
  border-color: var(--line-strong);
}

.rm {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border: 0;
  border-radius: var(--r-pill);
  background: transparent;
  color: var(--muted);
  cursor: pointer;
}

.rm:active {
  background: var(--line);
}

.add {
  display: flex;
  gap: 8px;
}

.add .btn {
  width: auto;
  flex-shrink: 0;
}

.field {
  flex: 1;
  min-width: 0;
  min-height: 44px;
  padding: 0 14px;
  border-radius: var(--r-ctrl);
  border: 1px solid var(--line-strong);
  background: var(--surface-2);
  color: var(--ink);
  font-family: var(--font-mono);
  font-size: 15px;
  font-weight: 700;
  text-transform: uppercase;
}

.field::placeholder {
  font-family: var(--font-body);
  font-weight: 500;
  text-transform: none;
  color: var(--muted);
}

.field:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 1px;
}

.fail {
  flex-direction: row;
  align-items: center;
  gap: 12px;
}

.fail .title {
  white-space: normal;
}

.field--short {
  flex: 0 0 104px;
  text-align: center;
}
</style>
