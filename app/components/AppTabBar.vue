<script setup lang="ts">
import { House, Activity, ChartColumn, SlidersHorizontal } from 'lucide-vue-next'

const route = useRoute()

const tabs = [
  { to: '/', label: 'Accueil', icon: House, match: (p: string) => p === '/' || p.startsWith('/notifications') },
  { to: '/activites', label: 'Activités', icon: Activity, match: (p: string) => p.startsWith('/activites') },
  { to: '/stats', label: 'Stats', icon: ChartColumn, match: (p: string) => p.startsWith('/stats') || p.startsWith('/recap') },
  { to: '/reglages', label: 'Réglages', icon: SlidersHorizontal, match: (p: string) => p.startsWith('/reglages') || p.startsWith('/historique') },
]

const active = computed(() => tabs.findIndex((t) => t.match(route.path)))
</script>

<template>
  <nav class="tabbar" aria-label="Navigation principale" :style="{ '--i': Math.max(active, 0) }">
    <!-- Pastille unique qui glisse d'un onglet à l'autre -->
    <span class="indicator" :class="{ hidden: active < 0 }" aria-hidden="true"><span /></span>

    <NuxtLink
      v-for="(t, i) in tabs"
      :key="t.to"
      :to="t.to"
      class="tab"
      :aria-current="i === active ? 'page' : undefined"
    >
      <span class="icon"><component :is="t.icon" :size="20" aria-hidden="true" /></span>
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
  animation: bar-in 0.7s var(--ease-spring) 0.2s backwards;
}

@keyframes bar-in {
  from {
    opacity: 0;
    transform: translate(-50%, 40px) scale(0.92);
  }
}

.indicator {
  position: absolute;
  top: 12px;
  left: 8px;
  width: calc((100% - 16px) / 4);
  height: 30px;
  display: flex;
  justify-content: center;
  transform: translateX(calc(var(--i) * 100%));
  transition: transform 0.5s var(--ease-spring), opacity 0.2s ease;
  pointer-events: none;
}

.indicator span {
  width: 52px;
  height: 30px;
  border-radius: 15px;
  background: var(--tab-active);
  box-shadow: var(--primary-shadow);
}

.indicator.hidden {
  opacity: 0;
}

.tab {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  min-height: 56px;
  padding-top: 4px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 500;
  border-radius: 20px;
  transition: color 0.25s ease;
}

.icon {
  display: grid;
  place-items: center;
  width: 52px;
  height: 30px;
  transition: transform 0.15s ease, color 0.25s ease;
}

.tab:active .icon {
  transform: scale(0.88);
}

.tab[aria-current='page'] {
  color: var(--ink);
  font-weight: 700;
}

.tab[aria-current='page'] .icon {
  color: var(--on-tab-active);
}

/* Petit rebond de l'icône quand l'onglet devient actif */
.tab[aria-current='page'] .icon svg {
  animation: pop 0.5s var(--ease-spring) 0.08s;
}
</style>
