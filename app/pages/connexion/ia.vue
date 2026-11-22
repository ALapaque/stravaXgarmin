<script setup lang="ts">
import { ArrowRight, ShieldCheck, ExternalLink } from 'lucide-vue-next'

definePageMeta({ layout: 'bare' })
useHead({ title: 'Activer l’IA · stravaXgarmin' })

// Mistral reste possible côté serveur, mais sa clé API n'est plus gratuite : pas proposé ici
type Provider = 'gemini' | 'openai'

const PROVIDERS: Record<Provider, { label: string; tag: string; url: string; site: string; steps: string[]; placeholder: string; note: string }> = {
  gemini: {
    label: 'Gemini',
    tag: 'Gratuit',
    url: 'https://aistudio.google.com/apikey',
    site: 'aistudio.google.com',
    steps: ['Connecte-toi avec ton compte Google.', 'Touche « Create API key » (« Créer une clé API »), puis copie-la.'],
    placeholder: 'AIza…',
    note: 'Gratuit, sans carte, avec un quota quotidien largement suffisant. En gratuit, Google peut utiliser les demandes pour améliorer ses produits.',
  },
  openai: {
    label: 'OpenAI',
    tag: 'Payant à l’usage',
    url: 'https://platform.openai.com/api-keys',
    site: 'platform.openai.com',
    steps: ['Ajoute un peu de crédit dans Billing (5 $ durent très longtemps).', 'Dans « API keys », crée une clé et copie-la.'],
    placeholder: 'sk-…',
    note: 'Facturé sur ton compte OpenAI, à part de l’abonnement ChatGPT. Les demandes ne sont pas conservées.',
  },
}

const route = useRoute()
const { refresh } = useAccounts()
const { show } = useToast()

const back = computed(() => {
  const r = String(route.query.retour ?? '')
  return r.startsWith('/') && !r.startsWith('//') ? r : '/reglages/comptes'
})

const provider = ref<Provider>('gemini')
const p = computed(() => PROVIDERS[provider.value])
const key = ref('')
const loading = ref(false)
const error = ref('')

watch(provider, () => (error.value = ''))

async function save() {
  error.value = ''
  loading.value = true
  try {
    await $fetch('/api/ia/cle', { method: 'POST', body: { provider: provider.value, key: key.value.trim() } })
    key.value = ''
    await refresh()
    show(`IA activée avec ${p.value.label}`)
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
      <h1 class="h1">Activer l’IA</h1>
      <p class="lead">Titres, analyses de séance et estimation de ton niveau, avec une clé à toi.</p>
    </div>

    <div class="providers" role="radiogroup" aria-label="Fournisseur d’IA">
      <label v-for="(cfg, id) in PROVIDERS" :key="id" class="card provider" :class="{ on: provider === id }">
        <input v-model="provider" class="sr-only" type="radio" name="provider" :value="id">
        <span class="title">{{ cfg.label }}</span>
        <span class="tag" :class="{ free: cfg.tag === 'Gratuit' }">{{ cfg.tag }}</span>
      </label>
    </div>

    <Transition name="swap" mode="out-in">
      <ol :key="provider" class="card card--pad steps">
        <li>
          Ouvre
          <a :href="p.url" target="_blank" rel="noopener" class="link">{{ p.site }} <ExternalLink :size="14" aria-hidden="true" /></a>
        </li>
        <li v-for="s in p.steps" :key="s">{{ s }}</li>
        <li>Colle la clé ci-dessous.</li>
      </ol>
    </Transition>

    <form class="card card--pad form" @submit.prevent="save">
      <label class="field">
        <span class="label">Clé {{ p.label }}</span>
        <input
          v-model="key"
          type="password"
          :placeholder="p.placeholder"
          autocomplete="off"
          autocapitalize="off"
          autocorrect="off"
          spellcheck="false"
          required
        >
      </label>
      <button type="submit" class="btn btn--primary" :disabled="loading || key.trim().length < 20">
        {{ loading ? 'Vérification…' : `Activer avec ${p.label}` }}
        <ArrowRight :size="20" aria-hidden="true" />
      </button>
    </form>

    <p v-if="error" class="err" role="alert">{{ error }}</p>

    <div class="card card--pad note">
      <ShieldCheck :size="22" aria-hidden="true" />
      <p>
        La clé est gardée chiffrée dans ton navigateur, jamais sur nos serveurs, et tu peux la retirer dans les réglages.
        Seuls les chiffres d’une course partent chez {{ p.label }}, et seulement quand tu demandes un titre ou une analyse.
        {{ p.note }}
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

.providers {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.provider {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  padding: 14px 12px;
  cursor: pointer;
  border: 2px solid transparent;
  transition: border-color 0.2s ease, transform 0.2s var(--ease-spring);
}

.provider.on {
  border-color: var(--primary-solid);
  transform: translateY(-2px);
}

.provider:has(input:focus-visible) {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
}

.tag {
  padding: 2px 8px;
  border-radius: 99px;
  font-size: 12px;
  font-weight: 700;
  color: var(--muted);
  background: var(--surface-2);
}

.tag.free {
  color: var(--ok);
  background: color-mix(in srgb, var(--ok) 16%, transparent);
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

.swap-enter-active,
.swap-leave-active {
  transition: opacity 0.2s ease, transform 0.25s var(--ease-out);
}

.swap-enter-from {
  opacity: 0;
  transform: translateX(16px);
}

.swap-leave-to {
  opacity: 0;
  transform: translateX(-16px);
}
</style>
