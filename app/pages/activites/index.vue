<script setup lang="ts">
useHead({ title: 'Activités · stravaXgarmin' })

const { sorted: activities, toReview } = useActivities()
const { accounts } = useAccounts()
const { active: demo } = useDemo()
const filter = ref<'all' | 'review'>('all')
const shown = computed(() => (filter.value === 'all' ? activities.value : toReview.value))
const totalKm = computed(() => activities.value.reduce((t, a) => t + a.distanceKm, 0))
</script>

<template>
  <div class="stack stack--wide">
    <div class="title-block">
      <p class="eyebrow">60 derniers jours<template v-if="activities.length"> · {{ activities.length }} courses · {{ formatKm(totalKm) }} km</template></p>
      <h1 class="h1 h1--xl">Activités</h1>
    </div>

    <ConnectPrompt v-if="!activities.length && !accounts.strava.connected && !demo" />

    <template v-else>
    <div class="segmented" role="group" aria-label="Filtrer les activités">
      <button type="button" :aria-pressed="filter === 'all'" @click="filter = 'all'">Toutes</button>
      <button type="button" :aria-pressed="filter === 'review'" @click="filter = 'review'">
        À revoir ({{ toReview.length }})
      </button>
    </div>

    <div v-if="shown.length" class="card list list--grid">
      <ActivityRow v-for="a in shown" :key="a.id" :activity="a" />
    </div>
    <p v-else class="card card--pad lead">{{ activities.length ? 'Aucun nom par défaut, rien à revoir.' : 'Aucune course sur les 60 derniers jours.' }}</p>
    </template>
  </div>
</template>

<style scoped>
.title-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
</style>
