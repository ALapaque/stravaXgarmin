<script setup lang="ts">
useHead({ title: 'Réglages · stravaXgarmin' })

const settings = useSettings()
const { theme, themes } = useTheme()
const { show } = useToast()

function connectChatGpt() {
  // TODO: flux « Sign in with ChatGPT » (vérifier l'ouverture du programme aux développeurs)
  settings.value.accounts.chatgpt = true
  show('ChatGPT connecté')
}
</script>

<template>
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
        <span class="title">Notifications</span>
        <span class="hint">Quand un nom change</span>
      </span>
      <ToggleSwitch v-model="settings.notifications" label="Notifications" />
    </div>
    <div class="row">
      <span class="row__main">
        <span class="title">Écraser un nom Strava</span>
        <span class="hint">Même modifié à la main</span>
      </span>
      <ToggleSwitch v-model="settings.overwriteEdited" label="Écraser un nom Strava modifié" />
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
      <input v-model="theme" class="sr" type="radio" name="theme" :value="t.id">
      <span class="swatch" :style="{ background: t.bg }" aria-hidden="true">
        <span v-for="c in t.swatch" :key="c" :style="{ background: c }" />
      </span>
      <span class="title">{{ t.label }}</span>
      <span class="hint">{{ t.description }}</span>
    </label>
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

.sr {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  opacity: 0;
}
</style>
