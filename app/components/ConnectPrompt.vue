<script setup lang="ts">
/** État vide quand aucun compte n'est connecté et que la démo est éteinte. */
withDefaults(defineProps<{ title?: string; text?: string }>(), {
  title: 'Connecte Strava pour commencer',
  text: 'Tes courses, leurs noms Garmin et tes stats apparaîtront ici. Rien n’est affiché tant que rien n’est connecté.',
})

const { enter } = useDemo()
</script>

<template>
  <section class="card card--pad prompt">
    <h2 class="h2">{{ title }}</h2>
    <p class="lead">{{ text }}</p>
    <a href="/api/auth/strava/login" class="btn btn--brand" style="--brand: var(--strava)">
      <BrandMark brand="strava" :size="28" inverse />
      Connecter Strava
    </a>
    <NuxtLink to="/connexion/garmin" class="btn btn--brand" style="--brand: var(--garmin)">
      <BrandMark brand="garmin" :size="28" inverse />
      Connecter Garmin
    </NuxtLink>
    <button type="button" class="link demo" @click="enter">Explorer la démo avec des données fictives</button>
  </section>
</template>

<style scoped>
.prompt {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.prompt .lead {
  margin-bottom: 8px;
}

.demo {
  align-self: center;
}
</style>
