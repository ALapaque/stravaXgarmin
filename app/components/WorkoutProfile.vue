<script setup lang="ts">
/* Profil d'une séance : une barre par étape, largeur = durée, hauteur = intensité. */
import type { PlanSession } from '~/composables/usePlan'

const props = withDefaults(defineProps<{ blocks: PlanSession['blocks']; height?: number }>(), { height: 56 })

const COLORS: Record<string, string> = {
  warmup: 'var(--info)',
  cooldown: 'var(--info)',
  interval: 'var(--accent-text)',
  recovery: 'var(--ok)',
  rest: 'var(--muted)',
  other: 'var(--type-long)',
}
const total = computed(() => props.blocks.reduce((s, b) => s + Math.max(b.sec, 1), 0) || 1)
</script>

<template>
  <div class="profile" :style="{ height: `${height}px` }" aria-hidden="true">
    <span
      v-for="(b, i) in blocks"
      :key="i"
      class="bar"
      :class="`k-${b.kind}`"
      :style="{
        flexGrow: Math.max(b.sec, 1) / total,
        height: `${Math.round(Math.max(b.level, 0.12) * 100)}%`,
        '--c': COLORS[b.kind],
        '--i': i,
      }"
    />
  </div>
</template>

<style scoped>
.profile {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  width: 100%;
}

.bar {
  flex-basis: 0;
  min-width: 3px;
  border-radius: 4px 4px 2px 2px;
  background: linear-gradient(180deg, var(--c), color-mix(in srgb, var(--c) 35%, transparent));
  transform-origin: bottom;
  animation: grow 0.7s var(--ease-spring) backwards;
  animation-delay: calc(250ms + var(--i) * 25ms);
}

.k-interval {
  box-shadow: 0 0 14px -2px color-mix(in srgb, var(--c) 70%, transparent);
}
</style>
