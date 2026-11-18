<script setup lang="ts">
import { House, Activity, ChartColumn, SlidersHorizontal } from 'lucide-vue-next'

const route = useRoute()

const tabs = [
  { to: '/', label: 'Accueil', icon: House, match: (p: string) => p === '/' },
  { to: '/activites', label: 'Activités', icon: Activity, match: (p: string) => p.startsWith('/activites') },
  { to: '/stats', label: 'Stats', icon: ChartColumn, match: (p: string) => p.startsWith('/stats') },
  { to: '/reglages', label: 'Réglages', icon: SlidersHorizontal, match: (p: string) => p.startsWith('/reglages') },
]
</script>

<template>
  <nav class="tabbar" aria-label="Navigation principale">
    <NuxtLink
      v-for="t in tabs"
      :key="t.to"
      :to="t.to"
      class="tab"
      :aria-current="t.match(route.path) ? 'page' : undefined"
    >
      <span class="pill"><component :is="t.icon" :size="20" aria-hidden="true" /></span>
      <span class="name">{{ t.label }}</span>
    </NuxtLink>
  </nav>
</template>

<style scoped>
.tabbar {
  position: fixed;
  z-index: 20;
  left: 50%;
  bottom: calc(env(safe-area-inset-bottom) + 12px);
  transform: translateX(-50%);
  width: min(calc(100% - 32px), 448px);
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  padding: 8px;
  border-radius: 36px;
  background: var(--tab-bg);
  border: 1px solid var(--tab-border);
  -webkit-backdrop-filter: blur(24px);
  backdrop-filter: blur(24px);
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.45);
}

.tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  min-height: 52px;
  justify-content: center;
  color: var(--muted);
  font-size: 12px;
  font-weight: 500;
  border-radius: 20px;
}

.pill {
  display: grid;
  place-items: center;
  width: 52px;
  height: 30px;
  border-radius: 15px;
  transition: background 0.2s ease;
}

.tab[aria-current='page'] {
  color: var(--ink);
  font-weight: 700;
}

.tab[aria-current='page'] .pill {
  background: var(--tab-active);
  color: var(--on-tab-active);
}
</style>
