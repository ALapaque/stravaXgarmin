<script setup lang="ts">
/* Réglages · Notifications : sur le téléphone (autorisation du navigateur) et par sorte de notification. */
useHead({ title: 'Notifications · stravaXgarmin' })

const settings = useSettings()
const { show } = useToast()
const { permission, syncPermission, requestPermission } = useNotifications()

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
</script>

<template>
  <div class="stack">
    <BackLink to="/reglages" label="Réglages" />
    <div class="title-block">
      <h1 class="h1">Notifications</h1>
      <p class="lead">Ce qui mérite de te faire signe.</p>
    </div>

    <div class="panel panel--narrow">
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
      <p class="fine">Toutes les notifications restent aussi dans la cloche, en haut d’Aujourd’hui.</p>
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

.hint {
  font-size: 15px;
  color: var(--muted);
}

.sub {
  padding-left: 28px;
}
</style>
