<script setup lang="ts">
import { ArrowRight, ShieldCheck, ExternalLink } from 'lucide-vue-next'

definePageMeta({ layout: 'bare' })
useHead({ title: 'Clé OpenAI · stravaXgarmin' })

const route = useRoute()
const { refresh } = useAccounts()
const { show } = useToast()

const back = computed(() => {
  const r = String(route.query.retour ?? '')
  return r.startsWith('/') && !r.startsWith('//') ? r : '/reglages'
})

const key = ref('')
const loading = ref(false)
const error = ref('')

async function save() {
  error.value = ''
  loading.value = true
  try {
    await $fetch('/api/openai/key', { method: 'POST', body: { key: key.value.trim() } })
    key.value = ''
    await refresh()
    show('IA activée')
    await navigateTo(back.value, { replace: true })
  } catch (e) {
    error.value = (e as { data?: { statusMessage?: string } }).data?.statusMessage ?? 'Impossible de vérifier la clé pour le moment'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="stack">
    <BackLink :to="back" label="Retour" />

    <div class="head">
      <BrandMark brand="chatgpt" :size="48" />
      <h1 class="h1">Activer l’IA</h1>
      <p class="lead">Avec ta clé API OpenAI : titres, analyses de séance et estimation de ton niveau.</p>
    </div>

    <ol class="card card--pad steps">
      <li>
        Crée une clé sur
        <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener" class="link">platform.openai.com <ExternalLink :size="14" aria-hidden="true" /></a>
      </li>
      <li>Ajoute un peu de crédit (Billing). Un titre coûte bien moins d’un centime.</li>
      <li>Colle la clé ci-dessous.</li>
    </ol>

    <form class="card card--pad form" @submit.prevent="save">
      <label class="field">
        <span class="label">Clé API</span>
        <input
          v-model="key"
          type="password"
          placeholder="sk-…"
          autocomplete="off"
          autocapitalize="off"
          autocorrect="off"
          spellcheck="false"
          required
        >
      </label>
      <button type="submit" class="btn btn--primary" :disabled="loading || key.trim().length < 20">
        {{ loading ? 'Vérification…' : 'Activer l’IA' }}
        <ArrowRight :size="20" aria-hidden="true" />
      </button>
    </form>

    <p v-if="error" class="err" role="alert">{{ error }}</p>

    <div class="card card--pad note">
      <ShieldCheck :size="22" aria-hidden="true" />
      <p>
        La clé est gardée chiffrée dans ton navigateur, jamais sur nos serveurs, et tu peux la retirer dans les réglages.
        Les chiffres d’une course partent chez OpenAI seulement quand tu demandes un titre ou une analyse, sans y être conservés.
        C’est facturé sur ton compte OpenAI, à part de l’abonnement ChatGPT.
      </p>
    </div>
  </div>
</template>

<style scoped>
.head {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.steps {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0;
  padding-left: 40px;
  color: var(--ink-2);
}

.steps .link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field input {
  min-height: 52px;
  padding: 0 14px;
  border-radius: var(--r-ctrl);
  border: 1px solid var(--line-strong);
  background: var(--surface-2);
  color: var(--ink);
  font: inherit;
  font-family: var(--font-mono);
  font-size: 16px;
  outline: none;
  transition: border-color 0.2s ease;
}

.field input:focus {
  border-color: var(--focus);
}

.err {
  margin: 0;
  color: var(--ko);
  font-weight: 600;
}

.note {
  display: flex;
  gap: 12px;
  color: var(--muted);
}

.note svg {
  flex-shrink: 0;
  color: var(--ok);
}

.note p {
  margin: 0;
  font-size: 15px;
}
</style>
