<script setup lang="ts">
/*
 * Petites animations des cartes de stats :
 * - hr : un battement d'électrocardiogramme par battement réel (168 bpm → 168 par minute)
 * - pace : des lignes de vitesse qui défilent d'autant plus vite que l'allure est rapide
 */
const props = defineProps<{ kind: 'hr' | 'pace'; value: number }>()

const duration = computed(() => {
  if (props.kind === 'hr') return `${(60 / props.value).toFixed(3)}s`
  // value = secondes par km. 4:00 → 0,6 s par cycle, 6:00 → 1,8 s
  return `${Math.max(0.35, (props.value - 140) / 100).toFixed(2)}s`
})
</script>

<template>
  <span class="pulse" :class="kind" :style="{ '--d': duration }" aria-hidden="true">
    <svg v-if="kind === 'hr'" viewBox="0 0 120 20" preserveAspectRatio="none">
      <g class="trace">
        <!-- Deux battements identiques côte à côte, décalés en boucle -->
        <path d="M0 12h14l3-4 3 4h4l3 6 4-17 4 15 2-4h23" />
        <path d="M60 12h14l3-4 3 4h4l3 6 4-17 4 15 2-4h23" />
      </g>
    </svg>
    <svg v-else viewBox="0 0 120 20" preserveAspectRatio="none">
      <g class="lines">
        <path d="M0 5h14M24 5h10M44 5h12M60 5h14M84 5h10M104 5h12" />
        <path d="M6 10h18M34 10h12M66 10h18M94 10h12" />
        <path d="M0 15h10M20 15h16M46 15h8M60 15h10M80 15h16M106 15h8" />
      </g>
    </svg>
  </span>
</template>

<style scoped>
.pulse {
  display: block;
  width: 100%;
  height: 18px;
  overflow: hidden;
  color: currentColor;
}

/* Le dessin fait deux fois la largeur et contient deux motifs : on le décale d'un motif en boucle */
svg {
  display: block;
  width: 200%;
  height: 100%;
  overflow: visible;
  animation: slide var(--d) linear infinite;
}

path {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
}

.pace path {
  opacity: 0.85;
}

.pace path:nth-child(2) {
  opacity: 0.5;
}

@keyframes slide {
  to {
    transform: translateX(-50%);
  }
}

@media (prefers-reduced-motion: reduce) {
  svg {
    animation: none;
  }
}
</style>
