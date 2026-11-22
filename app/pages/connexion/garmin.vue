<script setup lang="ts">
import { ArrowRight, ShieldCheck } from 'lucide-vue-next'

definePageMeta({ layout: 'bare' })
useHead({ title: 'Connexion Garmin · stravaXgarmin' })

const { refresh } = useAccounts()
const { show } = useToast()
const router = useRouter()

const step = ref<'password' | 'code'>('password')
const email = ref('')
const password = ref('')
const code = ref('')
const loading = ref(false)
const error = ref('')
const codeField = ref<HTMLInputElement>()

const message = (e: unknown) =>
  (e as { data?: { statusMessage?: string } }).data?.statusMessage ?? 'Connexion impossible pour le moment'

async function sendPassword() {
  error.value = ''
  loading.value = true
  try {
    const { status } = await $fetch<{ status: 'ok' | 'mfa' }>('/api/garmin/login', {
      method: 'POST',
      body: { email: email.value, password: password.value },
    })
    password.value = ''
    if (status === 'mfa') {
      step.value = 'code'
      await nextTick()
      codeField.value?.focus()
    } else await done()
  } catch (e) {
    error.value = message(e)
  } finally {
    loading.value = false
  }
}

async function sendCode() {
  error.value = ''
  loading.value = true
  try {
    await $fetch('/api/garmin/mfa', { method: 'POST', body: { code: code.value } })
    await done()
  } catch (e) {
    error.value = message(e)
    if ((e as { statusCode?: number }).statusCode === 410) step.value = 'password'
  } finally {
    loading.value = false
  }
}

async function done() {
  await refresh()
  show('Garmin connecté')
  await useSync().run()
  await router.push('/reglages/comptes')
}
</script>

<template>
  <div class="stack">
    <BackLink to="/connexion" label="Connexion" />

    <div class="head">
      <BrandMark brand="garmin" :size="48" />
      <h1 class="h1">Connecter Garmin</h1>
      <p class="lead">
        {{ step === 'password' ? 'Avec ton compte Garmin Connect.' : 'Garmin vient de t’envoyer un code de vérification.' }}
      </p>
    </div>

    <Transition name="swap" mode="out-in">
      <form v-if="step === 'password'" key="pw" class="card card--pad form" @submit.prevent="sendPassword">
        <label class="field">
          <span class="label">E-mail</span>
          <input v-model="email" type="email" autocomplete="username" inputmode="email" required>
        </label>
        <label class="field">
          <span class="label">Mot de passe</span>
          <input v-model="password" type="password" autocomplete="current-password" required>
        </label>
        <button type="submit" class="btn btn--primary" :disabled="loading || !email || !password">
          {{ loading ? 'Connexion…' : 'Continuer' }}
          <ArrowRight :size="20" aria-hidden="true" />
        </button>
      </form>

      <form v-else key="code" class="card card--pad form" @submit.prevent="sendCode">
        <label class="field">
          <span class="label">Code à 6 chiffres</span>
          <input
            ref="codeField"
            v-model="code"
            class="code"
            type="text"
            inputmode="numeric"
            autocomplete="one-time-code"
            maxlength="8"
            required
          >
        </label>
        <button type="submit" class="btn btn--primary" :disabled="loading || code.length < 4">
          {{ loading ? 'Vérification…' : 'Valider le code' }}
          <ArrowRight :size="20" aria-hidden="true" />
        </button>
      </form>
    </Transition>

    <p v-if="error" class="err" role="alert">{{ error }}</p>

    <div class="card card--pad note">
      <ShieldCheck :size="22" aria-hidden="true" />
      <p>
        Ton mot de passe sert une seule fois et n’est jamais enregistré. L’appli garde un jeton chiffré dans ton navigateur.
        Garmin n’a pas d’API officielle pour renommer : on passe par celle de son site, qui peut changer sans prévenir.
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
  font-size: 16px;
  outline: none;
  transition: border-color 0.2s ease;
}

.field input:focus {
  border-color: var(--focus);
}

.code {
  font-family: var(--font-mono);
  font-size: 24px !important;
  letter-spacing: 0.3em;
  text-align: center;
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
