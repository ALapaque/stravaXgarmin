<script setup lang="ts">
/*
 * Retour de Strava après autorisation.
 * Sur iPhone, une appli installée ouvre strava.com dans un mini-navigateur intégré et y reste
 * après le retour : plutôt que de recharger toute l'appli dedans, on invite à le fermer.
 * Ailleurs (navigateur classique, Android, ordinateur), on file directement à l'accueil.
 */
import { CircleCheck } from 'lucide-vue-next'

definePageMeta({ layout: 'bare' })
useHead({ title: 'Strava connecté · stravaXgarmin' })

const stay = ref(true)

onMounted(() => {
  const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent)
  if (standalone || !ios) {
    stay.value = false
    useToast().show('Strava connecté')
    navigateTo('/', { replace: true })
  }
})
</script>

<template>
  <div class="stack done">
    <span class="check" aria-hidden="true"><CircleCheck :size="56" /></span>
    <h1 class="h1">Strava est connecté</h1>
    <template v-if="stay">
      <p class="lead">Si tu viens de l’appli installée sur ton écran d’accueil, touche <strong>Fermer</strong> (la croix en haut à gauche) : elle se mettra à jour toute seule.</p>
      <NuxtLink to="/" class="link">Sinon, continuer ici</NuxtLink>
    </template>
  </div>
</template>

<style scoped>
.done {
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 16px;
  min-height: 70dvh;
}

.check {
  display: grid;
  place-items: center;
  width: 96px;
  height: 96px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--ok) 14%, transparent);
  color: var(--ok);
  animation: pop 0.7s var(--ease-spring) 0.1s backwards;
}

.done .lead {
  max-width: 32ch;
}
</style>
