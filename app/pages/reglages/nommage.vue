<script setup lang="ts">
import type { RunType } from '~/composables/useActivities'

useHead({ title: 'Règles de nommage · stravaXgarmin' })

const settings = useSettings()
const { sorted } = useActivities()
const { show } = useToast()

const types = Object.keys(RUN_TYPES) as RunType[]
const sample = (t: RunType) => sorted.value.find((a) => a.type === t)
const fields = ref<Record<string, HTMLInputElement | null>>({})

/** Insère la variable à la position du curseur dans le champ du type. */
function insert(t: RunType, key: string) {
  const el = fields.value[t]
  const tpl = settings.value.naming.templates[t]
  const start = el?.selectionStart ?? tpl.length
  const end = el?.selectionEnd ?? tpl.length
  // Espaces ajoutés autour de la variable si elle touche un autre mot
  const before = start > 0 && !/\s/.test(tpl[start - 1]!) ? ' ' : ''
  const after = end < tpl.length && !/\s/.test(tpl[end]!) ? ' ' : ''
  const token = `${before}{${key}}${after}`
  settings.value.naming.templates[t] = tpl.slice(0, start) + token + tpl.slice(end)
  nextTick(() => {
    el?.focus()
    el?.setSelectionRange(start + token.length, start + token.length)
  })
}

function reset() {
  settings.value.naming.templates = { ...DEFAULT_TEMPLATES }
  show('Modèles par défaut rétablis')
}
</script>

<template>
  <div class="stack">
    <BackLink to="/reglages/synchro" label="Titres et publication" />
    <div class="title-block">
      <h1 class="h1">Règles de nommage</h1>
      <p class="lead">Quand ta montre envoie un nom générique comme « Morning Run », la règle du type de séance le remplace.</p>
    </div>

    <div class="card list">
      <div class="row">
        <span class="row__main">
          <span class="title">Appliquer les règles</span>
          <span class="hint">Seulement sur les noms génériques</span>
        </span>
        <ToggleSwitch v-model="settings.naming.enabled" label="Appliquer les règles de nommage" />
      </div>
    </div>

    <section v-for="t in types" :key="t" class="card card--pad rule" :class="{ off: !settings.naming.enabled }">
      <div class="rule-head">
        <ActivityTile :type="t" />
        <label :for="`tpl-${t}`" class="title">{{ RUN_TYPES[t].label }}</label>
      </div>
      <input
        :id="`tpl-${t}`"
        :ref="(el) => (fields[t] = el as HTMLInputElement | null)"
        v-model="settings.naming.templates[t]"
        class="tpl"
        type="text"
        autocomplete="off"
        spellcheck="false"
      >
      <div class="tokens" role="group" :aria-label="`Ajouter une variable au modèle ${RUN_TYPES[t].label}`">
        <button v-for="k in NAMING_TOKENS" :key="k.key" type="button" class="token" @click="insert(t, k.key)">
          {{ k.label }}
        </button>
      </div>
      <p v-if="sample(t)" class="preview">
        <span class="label">Aperçu</span>
        <span class="title">{{ renderTemplate(sample(t)!, settings.naming.templates[t]) || '—' }}</span>
      </p>
    </section>

    <button type="button" class="link reset" @click="reset">Rétablir les modèles par défaut</button>
  </div>
</template>

<style scoped>
.title-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.hint {
  font-size: 15px;
  color: var(--muted);
}

.rule {
  display: flex;
  flex-direction: column;
  gap: 12px;
  transition: opacity 0.2s ease;
}

.rule.off {
  opacity: 0.5;
}

.rule-head {
  display: flex;
  align-items: center;
  gap: 12px;
}

.tpl {
  width: 100%;
  min-height: 48px;
  padding: 0 14px;
  border-radius: var(--r-ctrl);
  border: 1px solid var(--line-strong);
  background: var(--surface-2);
  color: var(--ink);
  font-family: var(--font-mono);
  font-size: 16px;
  outline: none;
  transition: border-color 0.2s ease;
}

.tpl:focus {
  border-color: var(--focus);
}

.tokens {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.token {
  min-height: 36px;
  padding: 0 12px;
  border-radius: 99px;
  border: 1px solid var(--line-strong);
  background: transparent;
  color: var(--ink-2);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.12s ease, background 0.2s ease;
}

.token::before {
  content: '+ ';
  color: var(--accent-text);
}

.token:active {
  transform: scale(0.94);
  background: var(--line);
}

.preview {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0;
  padding-top: 12px;
  border-top: 1px solid var(--line);
}

.reset {
  align-self: center;
}
</style>
