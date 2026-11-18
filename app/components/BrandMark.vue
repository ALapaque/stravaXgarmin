<script setup lang="ts">
/*
 * Logo d'un service. Dépose les fichiers officiels (kits presse / guides de marque)
 * dans public/brands/strava.svg, garmin.svg, chatgpt.svg : au prochain build, ils
 * remplacent automatiquement la pastille de couleur. Respecte les règles de chaque marque
 * (Strava impose ses boutons « Connect with Strava » et le logo « Powered by Strava »).
 */
const props = withDefaults(
  defineProps<{ brand: 'strava' | 'garmin' | 'chatgpt'; size?: number; inverse?: boolean }>(),
  { size: 44, inverse: false },
)

const BRANDS = {
  strava: { name: 'Strava', initial: 'S', color: 'var(--strava)' },
  garmin: { name: 'Garmin Connect', initial: 'G', color: 'var(--garmin)' },
  chatgpt: { name: 'ChatGPT', initial: 'C', color: 'var(--chatgpt)' },
}

const b = computed(() => BRANDS[props.brand])
const src = computed(() => `/brands/${props.brand}.svg`)

// Logos présents dans public/brands/, détectés au build (voir nuxt.config.ts)
const available = computed(() => (useRuntimeConfig().public.brands as string[]).includes(props.brand))
</script>

<template>
  <img
    v-if="available"
    class="brand brand--img"
    :src="src"
    alt=""
    :width="size"
    :height="size"
    :style="{ '--s': `${size}px` }"
    aria-hidden="true"
  >
  <span
    v-else
    class="brand"
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
  border-radius: calc(var(--s) * 0.27);
  background: var(--brand-c);
  color: #fff;
  font-family: 'Urbanist', system-ui, sans-serif;
  font-weight: 700;
  font-size: calc(var(--s) * 0.45);
  line-height: 1;
}

.brand--img {
  object-fit: contain;
  background: none;
}

.brand--inverse {
  background: #fff;
  color: var(--brand-c);
}
</style>
