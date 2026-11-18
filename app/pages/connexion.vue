<script setup lang="ts">
import { ArrowLeftRight } from 'lucide-vue-next'

definePageMeta({ layout: 'bare' })
useHead({ title: 'Connexion · stravaXgarmin' })

// TODO: remplacer par les flux OAuth Strava et Garmin (routes serveur /api/auth/*)
</script>

<template>
  <div class="stack">
    <div class="logo">
      <span class="mark" aria-hidden="true"><ArrowLeftRight :size="20" /></span>
      <span class="h2">stravaXgarmin</span>
    </div>

    <div class="hero">
      <h1 class="h1 h1--xl">
        Tes courses <span class="garmin">Garmin</span>, bien nommées sur <span class="strava">Strava</span>.
      </h1>
      <p class="lead">Le nom de chaque sortie est copié de Garmin Connect vers Strava dès que ta montre se synchronise.</p>
    </div>

    <div class="card list demo" aria-hidden="true">
      <div class="row">
        <BrandMark brand="garmin" :size="36" />
        <span class="row__main">
          <span class="label">Garmin Connect</span>
          <span class="title">Fractionné piste 10×400</span>
        </span>
      </div>
      <div class="row">
        <BrandMark brand="strava" :size="36" />
        <span class="row__main">
          <span class="label">Strava</span>
          <span class="title">Fractionné piste 10×400</span>
        </span>
        <StatusChip ok label="Copié" />
      </div>
    </div>

    <div class="actions">
      <NuxtLink to="/" class="btn btn--brand" style="--brand: var(--strava)">
        <BrandMark brand="strava" :size="28" inverse />
        Connecter Strava
      </NuxtLink>
      <NuxtLink to="/" class="btn btn--brand" style="--brand: var(--garmin)">
        <BrandMark brand="garmin" :size="28" inverse />
        Connecter Garmin
      </NuxtLink>
      <p class="fine">Lecture seule côté Garmin. Déconnexion possible à tout moment.</p>
    </div>
  </div>
</template>

<style scoped>
.logo {
  display: flex;
  align-items: center;
  gap: 10px;
}

.mark {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: var(--primary);
  color: var(--on-primary);
}

.hero {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 32px;
}

.garmin {
  color: #3da9f5;
}

.strava {
  color: var(--strava);
}

.demo .label {
  font-size: 13px;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: auto;
  padding-top: 16px;
}
</style>
