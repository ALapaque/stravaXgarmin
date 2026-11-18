<script setup lang="ts">
/*
 * Logo d'un service. Les fichiers officiels sont dans public/brands/
 * (strava, garmin, chatgpt en svg, png ou webp), détectés au build (nuxt.config.ts).
 * Sans fichier, une pastille aux couleurs de la marque.
 */
const props = withDefaults(
  defineProps<{ brand: 'strava' | 'garmin' | 'chatgpt'; size?: number; inverse?: boolean }>(),
  { size: 44, inverse: false },
)

const BRANDS = {
  // Le logo Strava est déjà une tuile : affiché tel quel. Les autres sont posés sur une tuile blanche.
  strava: { initial: 'S', color: 'var(--strava)', tile: false },
  garmin: { initial: 'G', color: 'var(--garmin)', tile: true },
  chatgpt: { initial: 'C', color: 'var(--chatgpt)', tile: true },
}

const b = computed(() => BRANDS[props.brand])
const src = computed(() => (useRuntimeConfig().public.brands as Record<string, string>)[props.brand])
</script>

<template>
  <span
    v-if="src"
    class="brand"
    :class="{ 'brand--tile': b.tile }"
    :style="{ '--s': `${size}px` }"
    aria-hidden="true"
  >
    <img :src="src" alt="" :width="size" :height="size">
  </span>
  <span
    v-else
    class="brand brand--dot"
    :class="{ 'brand--inverse': inverse }"
    :style="{ '--brand-c': b.color, '--s': `${size}px` }"
    aria-hidden="true"
  >{{ b.initial }}</span>
</template>

<style scoped>
.brand {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: var(--s);
  height: var(--s);
  border-radius: calc(var(--s) * 0.24);
  overflow: hidden;
}

.brand img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.brand--tile {
  padding: calc(var(--s) * 0.18);
  background: #fff;
}

.brand--dot {
  background: var(--brand-c);
  color: #fff;
  font-family: 'Urbanist', system-ui, sans-serif;
  font-weight: 700;
  font-size: calc(var(--s) * 0.45);
  line-height: 1;
}

.brand--inverse {
  background: #fff;
  color: var(--brand-c);
}
</style>
