<script setup lang="ts">
/* Réglages · Comptes : Strava, Garmin (et le renommage côté Garmin), IA, synchro à la demande, état des connexions. */
import { ChevronRight, Sparkles, Activity as Pulse, RefreshCw } from 'lucide-vue-next'

useHead({ title: 'Comptes · stravaXgarmin' })

const settings = useSettings()
const { show } = useToast()
const { accounts, disconnect } = useAccounts()
const { run: sync, syncing } = useSync()
const { summary: health } = useHealth()
const { active: demo } = useDemo()
// L'état des lectures n'est connu qu'une fois l'état sauvegardé chargé (après l'hydratation)
const mounted = ref(false)
onMounted(() => (mounted.value = true))
const healthErrors = computed(() => (mounted.value ? health.value.errors.length : 0))

async function logout(provider: 'strava' | 'garmin' | 'ai') {
  await disconnect(provider)
  if (provider === 'ai') return show('IA désactivée')
  if (provider === 'garmin') settings.value.garmin.rename = false
  show(provider === 'strava' ? 'Strava déconnecté' : 'Garmin déconnecté')
  await sync()
  if (provider === 'strava') await navigateTo('/')
}
</script>

<template>
  <div class="stack stack--wide">
    <BackLink to="/reglages" label="Réglages" />
    <div class="title-block">
      <h1 class="h1">Comptes</h1>
      <p class="lead">Tes connexions à Strava, Garmin et l’IA de ton choix.</p>
    </div>

    <div class="cols">
      <div class="col">
        <h2 class="eyebrow group">Connexions</h2>
        <div class="card list">
          <div class="row">
            <BrandMark brand="strava" />
            <span class="row__main">
              <span class="title">Strava</span>
              <span class="hint">{{ accounts.strava.connected ? (accounts.strava.name ?? 'Connecté') : demo ? 'Données de démo pour l’instant' : 'Pour lire et nommer tes courses' }}</span>
            </span>
            <button v-if="accounts.strava.connected" type="button" class="btn btn--sm btn--secondary" @click="logout('strava')">Déconnecter</button>
            <a v-else href="/api/auth/strava/login" class="btn btn--sm btn--brand" style="--brand: var(--strava)">Connecter</a>
          </div>
          <div class="row">
            <BrandMark brand="garmin" />
            <span class="row__main">
              <span class="title">Garmin Connect</span>
              <span class="hint">{{ accounts.garmin.connected ? (accounts.garmin.name ?? 'Connecté') : 'Pour ton plan, ta forme et les noms de ta montre' }}</span>
            </span>
            <button v-if="accounts.garmin.connected" type="button" class="btn btn--sm btn--secondary" @click="logout('garmin')">Déconnecter</button>
            <NuxtLink v-else to="/connexion/garmin" class="btn btn--sm btn--brand" style="--brand: var(--garmin)">Connecter</NuxtLink>
          </div>
          <div v-if="accounts.garmin.connected" class="row sub">
            <span class="row__main">
              <span class="title">Renommer aussi sur Garmin</span>
              <span class="hint warn">Passe par un accès non officiel de Garmin : peut cesser de marcher, à tes risques</span>
            </span>
            <ToggleSwitch v-model="settings.garmin.rename" label="Renommer aussi sur Garmin" />
          </div>
          <div class="row">
            <BrandMark v-if="accounts.ai.provider === 'openai'" brand="chatgpt" />
            <span v-else class="tile" style="--tile: var(--accent-text)" aria-hidden="true"><Sparkles :size="22" /></span>
            <span class="row__main">
              <span class="title">IA</span>
              <span class="hint">{{ accounts.ai.connected ? accounts.ai.name : 'Titres, analyses et bilans, gratuit avec Gemini' }}</span>
            </span>
            <button v-if="accounts.ai.connected" type="button" class="btn btn--sm btn--secondary" @click="logout('ai')">Retirer</button>
            <NuxtLink v-else :to="{ path: '/connexion/ia', query: { retour: '/reglages/comptes' } }" class="btn btn--sm btn--primary">Activer</NuxtLink>
          </div>
        </div>
      </div>

      <div class="col">
        <h2 class="eyebrow group">Lecture</h2>
        <div class="card list">
          <button v-if="accounts.strava.connected" type="button" class="row" :disabled="syncing" @click="sync(true)">
            <span class="tile" style="--tile: var(--info)" aria-hidden="true"><RefreshCw :size="22" :class="{ spin: syncing }" /></span>
            <span class="row__main">
              <span class="title">{{ syncing ? 'Synchro en cours…' : 'Synchroniser maintenant' }}</span>
              <span class="hint">Se fait aussi à chaque ouverture de l’appli</span>
            </span>
          </button>
          <NuxtLink to="/reglages/etat" class="row">
            <span class="tile" :style="{ '--tile': healthErrors ? 'var(--ko)' : 'var(--ok)' }" aria-hidden="true"><Pulse :size="22" /></span>
            <span class="row__main">
              <span class="title">État des connexions</span>
              <span class="hint" :class="{ warn: healthErrors }">{{ healthErrors ? `${healthErrors} ${healthErrors > 1 ? 'lectures' : 'lecture'} en échec` : 'Tout fonctionne' }}</span>
            </span>
            <span v-if="healthErrors" class="dot" aria-label="à vérifier" />
            <ChevronRight class="go" :size="20" aria-hidden="true" />
          </NuxtLink>
        </div>
        <p v-if="!accounts.strava.connected" class="fine">La synchro à la demande apparaît ici une fois Strava connecté.</p>
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
  font-size: 15px;
  color: var(--muted);
}

.sub {
  padding-left: 28px;
}

.warn {
  color: var(--ko);
}

.go {
  flex-shrink: 0;
  color: var(--muted);
}

.dot {
  flex-shrink: 0;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--ko);
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
