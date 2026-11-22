<script setup lang="ts">
/*
 * Vignette d'une course : le tracé pour une course dehors qui en a un (inventé seulement en démo,
 * jamais sur tapis) ; sinon le mini-profil de la séance, une barre par tour (largeur = durée,
 * hauteur = vitesse) dans la teinte du type ; sans tours ni tracé, un simple pictogramme.
 * Remplit son conteneur (le parent fixe la taille).
 */
import { Footprints } from 'lucide-vue-next'
import type { Activity } from '~/composables/useActivities'

const props = withDefaults(defineProps<{ activity: Activity; draw?: boolean; width?: number }>(), { draw: false, width: 5 })

const a = computed(() => props.activity)
const color = computed(() => RUN_TYPES[a.value.type].color)
/** Tracé : dehors, avec une polyline ; en démo (pas d'identifiant Strava), un parcours inventé */
const hasRoute = computed(() => !a.value.indoor && (Boolean(a.value.route) || !a.value.stravaId))
const bars = computed(() => (hasRoute.value ? [] : lapProfile(a.value.laps).bars))
const total = computed(() => bars.value.reduce((t, b) => t + b.sec, 0) || 1)
const TIER_MIX = [52, 68, 84, 100]
</script>

<template>
  <RouteTrace v-if="hasRoute" :activity="activity" :draw="draw" :glow="draw" :width="width" />
  <svg v-else-if="bars.length > 1" class="mini" :class="{ draw }" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
    <rect
      v-for="(b, i) in bars"
      :key="i"
      :x="(b.t0 / total) * 100"
      :y="100 - b.level * 100"
      :width="Math.max((b.sec / total) * 100 - 1.2, 0.8)"
      :height="b.level * 100"
      :style="{ fill: `color-mix(in oklab, ${color} ${TIER_MIX[b.tier]}%, transparent)`, '--i': i }"
    />
  </svg>
  <span v-else class="none" :style="{ color }" aria-hidden="true"><Footprints :size="22" /></span>
</template>

<style scoped>
.mini {
  display: block;
  width: 100%;
  height: 100%;
}

.mini.draw rect {
  transform-box: fill-box;
  transform-origin: bottom;
  animation: grow 0.6s var(--ease-spring) backwards;
  animation-delay: calc(250ms + var(--i) * 18ms);
}

.none {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  opacity: 0.85;
}
</style>
