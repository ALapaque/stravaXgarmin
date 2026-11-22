<script setup lang="ts">
import { ChevronRight, History, Type, Sparkles, Palette, Activity as Pulse } from 'lucide-vue-next'

useHead({ title: 'Réglages · stravaXgarmin' })

const settings = useSettings()
const { theme, themes, customized } = useTheme()
const { show } = useToast()
const { permission, syncPermission, requestPermission } = useNotifications()
const { entries } = useHistory()
const { current: appVersion, showHistory } = useUpdates()
const { accounts, disconnect } = useAccounts()
const { run: sync, syncing } = useSync()
const { summary: health } = useHealth()
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

const { tab, direction } = useTab(['comptes', 'synchro', 'notifs', 'style'] as const, 'comptes')
// Rubriques affichées sur la deuxième face de la barre du bas
useSubnav('reglages', 'Rubriques des réglages', () => [
  { id: 'comptes', label: 'Comptes', icon: 'accounts', dot: healthErrors.value > 0 },
  { id: 'synchro', label: 'Synchro', icon: 'sync' },
  { id: 'notifs', label: 'Notifs', icon: 'bell' },
  { id: 'style', label: 'Style', icon: 'style' },
], tab)

onMounted(syncPermission)


/** Activer les notifications système demande d'abord l'autorisation au navigateur. */
const systemNotif = computed({
  get: () => settings.value.notify.system && permission.value === 'granted',
  set: async (on: boolean) => {
    if (!on) {
      settings.value.notify.system = false
      return
    }
    const ok = await requestPermission()
    settings.value.notify.system = ok
    if (!ok) show(permission.value === 'unsupported' ? 'Ton navigateur ne gère pas les notifications' : 'Notifications refusées par le navigateur')
  },
})

const notifHint = computed(() => {
  if (permission.value === 'unsupported') return 'Non disponible ici. Sur iPhone : installe l’appli sur l’écran d’accueil.'
  if (permission.value === 'denied') return 'Bloquées dans les réglages du navigateur'
  return 'Pendant que l’appli est ouverte ou en arrière-plan'
})

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
    <h1 class="h1 h1--xl">Réglages</h1>

    <Transition :name="`tab-${direction}`" mode="out-in">
      <div v-if="tab === 'comptes'" key="comptes" class="panel cols">
        <div class="col">
        <h2 class="eyebrow group">Comptes</h2>
        <div class="card list">
          <div class="row">
            <BrandMark brand="strava" />
            <span class="row__main">
              <span class="title">Strava</span>
              <span class="hint">{{ accounts.strava.connected ? (accounts.strava.name ?? 'Connecté') : 'Données de démo pour l’instant' }}</span>
            </span>
            <button v-if="accounts.strava.connected" type="button" class="btn btn--sm btn--secondary" @click="logout('strava')">Déconnecter</button>
            <a v-else href="/api/auth/strava/login" class="btn btn--sm btn--brand" style="--brand: var(--strava)">Connecter</a>
          </div>
          <div class="row">
            <BrandMark brand="garmin" />
            <span class="row__main">
              <span class="title">Garmin Connect</span>
              <span class="hint">{{ accounts.garmin.connected ? (accounts.garmin.name ?? 'Connecté') : 'Pour lire les noms de ta montre' }}</span>
            </span>
            <button v-if="accounts.garmin.connected" type="button" class="btn btn--sm btn--secondary" @click="logout('garmin')">Déconnecter</button>
            <NuxtLink v-else to="/connexion/garmin" class="btn btn--sm btn--brand" style="--brand: var(--garmin)">Connecter</NuxtLink>
          </div>
          <div v-if="accounts.garmin.connected" class="row sub">
            <span class="row__main">
              <span class="title">Renommer aussi sur Garmin</span>
              <span class="hint warn">API non officielle : peut casser, à tes risques</span>
            </span>
            <ToggleSwitch v-model="settings.garmin.rename" label="Renommer aussi sur Garmin" />
          </div>
          <div class="row">
            <BrandMark v-if="accounts.ai.provider === 'openai'" brand="chatgpt" />
            <span v-else class="tile" style="--tile: var(--accent-text)" aria-hidden="true"><Sparkles :size="22" /></span>
            <span class="row__main">
              <span class="title">IA</span>
              <span class="hint">{{ accounts.ai.connected ? accounts.ai.name : 'Titres et analyses, gratuit avec Gemini' }}</span>
            </span>
            <button v-if="accounts.ai.connected" type="button" class="btn btn--sm btn--secondary" @click="logout('ai')">Retirer</button>
            <NuxtLink v-else :to="{ path: '/connexion/ia', query: { retour: '/reglages' } }" class="btn btn--sm btn--primary">Activer</NuxtLink>
          </div>
          <button v-if="accounts.strava.connected" type="button" class="row" :disabled="syncing" @click="sync(true)">
            <span class="row__main">
              <span class="title">{{ syncing ? 'Synchro en cours…' : 'Synchroniser maintenant' }}</span>
              <span class="hint">Se fait aussi à chaque ouverture de l’appli</span>
            </span>
          </button>
        </div>
        <NuxtLink to="/reglages/etat" class="card row health-link">
          <span class="tile" :style="healthErrors ? { '--tile': 'var(--ko)' } : undefined" aria-hidden="true"><Pulse :size="22" /></span>
          <span class="row__main">
            <span class="title">État des connexions</span>
            <span class="hint" :class="{ warn: healthErrors }">{{ healthErrors ? `${healthErrors} ${healthErrors > 1 ? 'lectures' : 'lecture'} en échec` : 'Tout fonctionne' }}</span>
          </span>
          <ChevronRight :size="20" aria-hidden="true" />
        </NuxtLink>
        </div>
        <div class="col">
        <h2 class="eyebrow group">Application</h2>
        <div class="card list">
          <button type="button" class="row" @click="showHistory">
            <span class="tile" aria-hidden="true"><Sparkles :size="22" /></span>
            <span class="row__main">
              <span class="title">Quoi de neuf</span>
              <span class="hint">Version {{ appVersion }} · notes de version</span>
            </span>
            <ChevronRight :size="20" aria-hidden="true" />
          </button>
        </div>
        </div>
      </div>

      <div v-else-if="tab === 'synchro'" key="synchro" class="panel cols">
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
            <ChevronRight :size="20" aria-hidden="true" />
          </NuxtLink>
          <NuxtLink to="/historique" class="row">
            <span class="tile" aria-hidden="true"><History :size="22" /></span>
            <span class="row__main">
              <span class="title">Historique des modifications</span>
              <span class="hint">{{ entries.length }} changements, annulables</span>
            </span>
            <ChevronRight :size="20" aria-hidden="true" />
          </NuxtLink>
        </div>
        </div>
        <div class="col">
        <h2 class="eyebrow group">Texte du débrief sur Strava</h2>
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

      <div v-else-if="tab === 'notifs'" key="notifs" class="panel panel--narrow">
        <h2 class="eyebrow group">Notifications</h2>
        <div class="card list">
          <div class="row">
            <span class="row__main">
              <span class="title">Sur le téléphone</span>
              <span class="hint">{{ notifHint }}</span>
            </span>
            <ToggleSwitch v-model="systemNotif" label="Notifications sur le téléphone" />
          </div>
          <div v-for="(k, id) in NOTIF_KINDS" :key="id" class="row sub">
            <span class="row__main">
              <span class="title">{{ k.label }}</span>
              <span class="hint">{{ k.hint }}</span>
            </span>
            <ToggleSwitch v-model="settings.notify.kinds[id]" :label="k.label" />
          </div>
        </div>
      </div>

      <div v-else key="style" class="panel">
        <h2 id="theme-title" class="eyebrow group">Thème</h2>
        <div class="themes" role="radiogroup" aria-labelledby="theme-title">
          <label v-for="t in themes" :key="t.id" class="theme card" :class="{ on: theme === t.id }">
            <input v-model="theme" class="sr-only" type="radio" name="theme" :value="t.id">
            <span class="swatch" :style="{ background: t.bg }" aria-hidden="true">
              <span v-for="c in t.swatch" :key="c" :style="{ background: c }" />
            </span>
            <span class="title">{{ t.label }}</span>
            <span class="hint">{{ t.description }}</span>
          </label>
        </div>
        <NuxtLink to="/reglages/apparence" class="card row custom">
          <span class="tile" aria-hidden="true"><Palette :size="22" /></span>
          <span class="row__main">
            <span class="title">Personnaliser</span>
            <span class="hint">{{ customized ? 'Réglages sur mesure actifs' : 'Couleur, arrondis, police, fond animé' }}</span>
          </span>
          <ChevronRight :size="20" aria-hidden="true" />
        </NuxtLink>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.group {
  margin-top: 4px;
  color: var(--accent-text);
}

.hint {
  font-size: 15px;
  color: var(--muted);
}

.row .tile {
  --tile: var(--accent-text);
}

.sub {
  padding-left: 28px;
}

.intro {
  min-height: 0;
  margin: 0;
}

.soon {
  flex-shrink: 0;
  padding: 6px 12px;
  border-radius: 99px;
  font-size: 13px;
  font-weight: 700;
  color: var(--chatgpt);
  background: color-mix(in srgb, var(--chatgpt) 16%, transparent);
}

.warn {
  color: var(--ko);
}

.themes {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

@media (min-width: 720px) {
  .themes {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (min-width: 1280px) {
  .themes {
    grid-template-columns: repeat(6, 1fr);
  }
}

.theme {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 14px;
  cursor: pointer;
  transition: box-shadow 0.2s ease, transform 0.15s ease;
}

.theme:active {
  transform: scale(0.98);
}

.theme.on {
  border-color: transparent;
  box-shadow: 0 0 0 2px var(--primary-solid);
}

.theme:has(input:focus-visible) {
  outline: 2px solid var(--focus);
  outline-offset: 3px;
}

.swatch {
  display: flex;
  gap: 4px;
  padding: 6px;
  margin-bottom: 6px;
  border-radius: 10px;
  border: 1px solid var(--line-strong);
}

.swatch span {
  flex: 1;
  height: 22px;
  border-radius: 6px;
}

.theme .hint {
  font-size: 13px;
  line-height: 1.35;
}
</style>
