<script setup lang="ts">
/*
 * Tracé du parcours : la polyline Strava, ou un parcours inventé en démo.
 * Se dessine à l'apparition, avec un halo de la couleur du type de séance.
 * Sans GPS (tapis, salle), une onde stylisée prend sa place.
 */
import type { Activity } from '~/composables/useActivities'

const props = withDefaults(
  defineProps<{ activity: Activity; draw?: boolean; glow?: boolean; width?: number; delay?: number }>(),
  { draw: true, glow: true, width: 2.4, delay: 0 },
)

const color = computed(() => RUN_TYPES[props.activity.type].color)
const uid = useId()
const d = computed(() => {
  const a = props.activity
  if (a.route) return routePath(decodePolyline(a.route))
  if (!a.stravaId) return routePath(demoRoute(a.id, a.type))
  return ''
})
const start = computed(() => d.value.match(/^M([\d.]+) ([\d.]+)/)?.slice(1).map(Number))
const end = computed(() => d.value.match(/L([\d.]+) ([\d.]+)$/)?.slice(1).map(Number))
</script>

<template>
  <svg class="trace" :class="{ draw }" viewBox="0 0 100 100" :style="{ '--c': color, '--delay': `${delay}ms` }" aria-hidden="true">
    <defs>
      <linearGradient :id="`g${uid}`" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="var(--c)" stop-opacity="0.55" />
        <stop offset="1" stop-color="var(--c)" />
      </linearGradient>
      <filter :id="`f${uid}`" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="3" />
      </filter>
    </defs>
    <template v-if="d">
      <path v-if="glow" class="halo" :d="d" pathLength="1" :stroke-width="width * 2.6" :filter="`url(#f${uid})`" />
      <path class="line" :d="d" pathLength="1" :stroke="`url(#g${uid})`" :stroke-width="width" />
      <circle v-if="start" class="dot dot--start" :cx="start[0]" :cy="start[1]" :r="width * 1.2" />
      <circle v-if="end" class="dot dot--end" :cx="end[0]" :cy="end[1]" :r="width * 1.5" />
    </template>
    <path
      v-else
      class="line wave"
      d="M8 50 C 20 50, 22 30, 32 30 S 44 70, 54 70 S 66 36, 76 36 S 88 50, 92 50"
      pathLength="1"
      :stroke="`url(#g${uid})`"
      :stroke-width="width"
    />
  </svg>
</template>

<style scoped>
.trace {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
}

path {
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.halo {
  stroke: var(--c);
  opacity: 0.55;
}

.draw .line,
.draw .halo {
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
  animation: draw 1.6s var(--ease-out) var(--delay) forwards;
}

@keyframes draw {
  to {
    stroke-dashoffset: 0;
  }
}

.dot {
  fill: var(--bg);
  stroke: var(--c);
  stroke-width: 1.4;
}

.dot--end {
  fill: var(--c);
  stroke: var(--bg);
}

.draw .dot--end {
  transform-box: fill-box;
  transform-origin: center;
  animation: pop 0.5s var(--ease-spring) calc(var(--delay) + 1.4s) backwards;
}

@media (prefers-reduced-motion: reduce) {
  .draw .line,
  .draw .halo {
    stroke-dashoffset: 0;
    animation: none;
  }
}
</style>
