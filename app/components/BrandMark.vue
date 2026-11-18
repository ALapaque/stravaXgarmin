<script setup lang="ts">
/*
 * Emplacement de logo aux couleurs de la marque.
 * À remplacer par les fichiers officiels (kits presse / guides de marque) :
 * mettre le SVG dans public/brands/<marque>.svg et l'afficher ici.
 * Strava impose ses boutons « Connect with Strava » et le logo « Powered by Strava ».
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
</script>

<template>
  <span
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

.brand--inverse {
  background: #fff;
  color: var(--brand-c);
}
</style>
