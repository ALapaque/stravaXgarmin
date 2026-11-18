<script setup lang="ts">
useHead({ title: 'Activités · stravaXgarmin' })

const { sorted: activities, toReview } = useActivities()
const { accounts } = useAccounts()
const { active: demo } = useDemo()
const filter = ref<'all' | 'review'>('all')
const shown = computed(() => (filter.value === 'all' ? activities.value : toReview.value))
</script>

<template>
  <div class="stack">
    <h1 class="h1">Activités</h1>

    <ConnectPrompt v-if="!activities.length && !accounts.strava.connected && !demo" />

    <template v-else>
    <div class="segmented" role="group" aria-label="Filtrer les activités">
      <button type="button" :aria-pressed="filter === 'all'" @click="filter = 'all'">Toutes</button>
      <button type="button" :aria-pressed="filter === 'review'" @click="filter = 'review'">
        À revoir ({{ toReview.length }})
      </button>
    </div>

    <div v-if="shown.length" class="card list">
      <ActivityRow v-for="a in shown" :key="a.id" :activity="a" />
    </div>
    <p v-else class="card card--pad lead">{{ activities.length ? 'Tout est synchronisé, rien à revoir.' : 'Aucune course sur les 60 derniers jours.' }}</p>
    </template>
  </div>
</template>
