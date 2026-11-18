<script setup lang="ts">
import { ChevronRight, History, Type } from 'lucide-vue-next'

useHead({ title: 'Réglages · stravaXgarmin' })

const settings = useSettings()
const { theme, themes } = useTheme()
const { show } = useToast()
const { permission, syncPermission, requestPermission } = useNotifications()
const { entries } = useHistory()

onMounted(syncPermission)

function connectChatGpt() {
  // TODO: flux « Sign in with ChatGPT » (vérifier l'ouverture du programme aux développeurs)
  settings.value.accounts.chatgpt = true
  show('ChatGPT connecté')
}

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
  return 'Même quand l’appli est en arrière-plan'
})

const descriptionParts = [
  { key: 'weather', label: 'Météo', hint: 'Température, ciel et vent' },
  { key: 'splits', label: 'Temps au kilomètre', hint: 'Chaque kilomètre complet' },
  { key: 'shoes', label: 'Chaussures', hint: 'Modèle et kilométrage' },
  { key: 'signature', label: 'Signature', hint: '« — via stravaXgarmin »' },
] as const
</script>

<template>
  <div class="stack">
    <h1 class="h1">Réglages</h1>

    <h2 class="label group">Synchronisation</h2>
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

    <h2 class="label group">Description Strava</h2>
    <div class="card list">
      <div class="row">
        <span class="row__main">
          <span class="title">Description enrichie</span>
          <span class="hint">Ajoutée à chaque course synchronisée</span>
        </span>
        <ToggleSwitch v-model="settings.description.enabled" label="Description enrichie" />
      </div>
      <template v-if="settings.description.enabled">
        <div v-for="p in descriptionParts" :key="p.key" class="row sub">
          <span class="row__main">
            <span class="title">{{ p.label }}</span>
            <span class="hint">{{ p.hint }}</span>
          </span>
          <ToggleSwitch v-model="settings.description[p.key]" :label="p.label" />
        </div>
      </template>
    </div>

    <h2 class="label group">Notifications</h2>
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

    <h2 class="label group">Comptes</h2>
    <div class="card list">
      <div class="row">
        <BrandMark brand="strava" />
        <span class="row__main"><span class="title">Strava</span></span>
        <StatusChip :ok="settings.accounts.strava" :label="settings.accounts.strava ? 'Connecté' : 'Déconnecté'" />
      </div>
      <div class="row">
        <BrandMark brand="garmin" />
        <span class="row__main"><span class="title">Garmin Connect</span></span>
        <StatusChip :ok="settings.accounts.garmin" :label="settings.accounts.garmin ? 'Connecté' : 'Déconnecté'" />
      </div>
      <div class="row">
        <BrandMark brand="chatgpt" />
        <span class="row__main">
          <span class="title">ChatGPT</span>
          <span class="hint">Titres et analyses via ton abonnement</span>
        </span>
        <StatusChip v-if="settings.accounts.chatgpt" ok label="Connecté" />
        <button v-else type="button" class="btn btn--sm btn--brand" style="--brand: var(--chatgpt)" @click="connectChatGpt">
          Connecter
        </button>
      </div>
    </div>

    <h2 id="theme-title" class="label group">Thème</h2>
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

.themes {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
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
