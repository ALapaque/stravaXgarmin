<script setup lang="ts">
definePageMeta({ layout: 'bare' })
useHead({ title: 'Connexion · stravaXgarmin' })

const route = useRoute()
const { accounts } = useAccounts()

const ERRORS: Record<string, string> = {
  'strava-refus': 'Connexion Strava annulée.',
  'strava-etat': 'La connexion Strava a expiré, recommence.',
  'strava-permissions': 'Coche « modifier tes activités » sur Strava : sans ça, impossible de renommer.',
}
const error = computed(() => ERRORS[String(route.query.erreur ?? '')])
</script>

<template>
  <div class="stack">
    <div class="logo">
      <img class="mark" src="/favicon.svg" alt="" width="36" height="36">
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
      <p v-if="error" class="card card--pad err" role="alert">{{ error }}</p>
      <!-- Lien externe : la route serveur redirige vers Strava -->
      <a v-if="!accounts.strava.connected" href="/api/auth/strava/login" class="btn btn--brand" style="--brand: var(--strava)">
        <BrandMark brand="strava" :size="28" inverse />
        Connecter Strava
      </a>
      <NuxtLink v-if="!accounts.garmin.connected" to="/connexion/garmin" class="btn btn--brand" style="--brand: var(--garmin)">
        <BrandMark brand="garmin" :size="28" inverse />
        Connecter Garmin
      </NuxtLink>
      <NuxtLink to="/" class="link demo">{{ accounts.strava.connected ? 'Aller à l’accueil' : 'Essayer avec des données de démo' }}</NuxtLink>
      <p class="fine">Tes identifiants ne sont jamais stockés : seuls des jetons chiffrés restent dans ton navigateur.</p>
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
  width: 36px;
  height: 36px;
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

.err {
  margin: 0;
  color: var(--ko);
  font-weight: 600;
}

.demo {
  align-self: center;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: auto;
  padding-top: 16px;
}
</style>
