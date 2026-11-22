<script setup lang="ts">
/* Course pas encore là (état d'attente) ou introuvable, pour une adresse de course ouverte directement. */
import { LoaderCircle, SearchX } from 'lucide-vue-next'

defineProps<{ state: 'loading' | 'missing' }>()
</script>

<template>
  <div class="pending" :class="state" role="status" aria-live="polite">
    <template v-if="state === 'loading'">
      <LoaderCircle class="spin" :size="26" aria-hidden="true" />
      <p class="lead">Chargement de ta course…</p>
    </template>
    <template v-else>
      <span class="tile" aria-hidden="true"><SearchX :size="22" /></span>
      <p class="h2">Cette course n’est plus dans tes 60 derniers jours.</p>
      <NuxtLink to="/activites" class="btn btn--secondary btn--sm">Voir mes activités</NuxtLink>
    </template>
  </div>
</template>

<style scoped>
.pending {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  min-height: 46dvh;
  text-align: center;
}

.pending .lead {
  color: var(--muted);
}

.pending .h2 {
  max-width: 26ch;
}

.missing .tile {
  --tile: var(--accent-text);
}

.spin {
  color: var(--accent-text);
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
