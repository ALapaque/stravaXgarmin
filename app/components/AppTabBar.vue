<script setup lang="ts">
/*
 * Barre du bas à deux faces. La face avant est le menu principal ; quand l'écran a des
 * rubriques (Stats, Réglages, une course), la barre pivote comme un rouleau pour montrer
 * son sous-menu. Le bouton de gauche la fait pivoter à nouveau vers le menu principal,
 * et toucher l'onglet déjà actif rouvre le sous-menu.
 */
import {
  House, Activity, CalendarClock, ChartColumn, SlidersHorizontal, LayoutGrid, Layers,
  HeartPulse, Trophy, Sparkles, Footprints, Link2, RefreshCw, Bell, Palette, Gauge, PenLine,
} from 'lucide-vue-next'
import type { Subnav } from '~/composables/useSubnav'

const route = useRoute()
const router = useRouter()

const tabs = [
  { to: '/', label: 'Accueil', icon: House, match: (p: string) => p === '/' || p.startsWith('/notifications') },
  { to: '/activites', label: 'Activités', icon: Activity, match: (p: string) => p.startsWith('/activites') },
  { to: '/plan', label: 'Plan', icon: CalendarClock, match: (p: string) => p.startsWith('/plan') },
  { to: '/stats', label: 'Stats', icon: ChartColumn, match: (p: string) => p.startsWith('/stats') || p.startsWith('/recap') || p.startsWith('/objectif') },
  { to: '/reglages', label: 'Réglages', icon: SlidersHorizontal, match: (p: string) => p.startsWith('/reglages') || p.startsWith('/historique') },
]
const active = computed(() => tabs.findIndex((t) => t.match(route.path)))

const SUB_ICONS: Record<string, unknown> = {
  forme: HeartPulse, records: Trophy, ia: Sparkles, shoes: Footprints,
  accounts: Link2, sync: RefreshCw, bell: Bell, style: Palette,
  numbers: Gauge, name: PenLine,
}

const sub = useSubnavState()
// Dernier sous-menu connu : il reste dessiné pendant que la barre revient au menu principal
const shown = ref<Subnav | null>(sub.value)
const flipped = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined

onMounted(() => {
  watch(
    () => sub.value?.key,
    (key) => {
      clearTimeout(timer)
      if (key) {
        shown.value = sub.value
        // Laisse l'écran arriver, puis la barre pivote vers ses rubriques
        timer = setTimeout(() => (flipped.value = true), 280)
      } else {
        flipped.value = false
      }
    },
    { immediate: true },
  )
})
watch(sub, (s) => {
  if (s) shown.value = s
}, { deep: true })
onBeforeUnmount(() => clearTimeout(timer))

const subIndex = computed(() => Math.max(shown.value?.items.findIndex((i) => i.id === shown.value?.current) ?? 0, 0))

function onMain(i: number, e: MouseEvent) {
  // Onglet déjà ouvert et écran à rubriques : on rouvre le sous-menu au lieu de recharger
  if (i === active.value && sub.value && route.path === tabs[i]!.to) {
    e.preventDefault()
    flipped.value = true
  }
}

function pick(id: string) {
  router.replace({ query: { ...route.query, onglet: id } })
}
</script>

<template>
  <nav class="tabbar" :class="{ flipped }" :aria-label="flipped && shown ? shown.label : 'Navigation principale'">
    <!-- Face avant : menu principal -->
    <div class="face front" :inert="flipped || undefined" :style="{ '--i': Math.max(active, 0), '--n': 5 }">
      <span class="indicator" :class="{ hidden: active < 0 }" aria-hidden="true"><span /></span>
      <NuxtLink
        v-for="(t, i) in tabs"
        :key="t.to"
        :to="t.to"
        class="tab"
        :aria-current="i === active ? 'page' : undefined"
        @click="onMain(i, $event)"
      >
        <span class="icon">
          <component :is="t.icon" :size="20" aria-hidden="true" />
          <Layers v-if="i === active && sub" class="has-sub" :size="11" aria-label="sous-menu disponible" />
        </span>
        <span class="name">{{ t.label }}</span>
      </NuxtLink>
    </div>

    <!-- Face arrière : rubriques de l'écran -->
    <div v-if="shown" class="face back" :inert="!flipped || undefined" :style="{ '--i': subIndex, '--n': shown.items.length }">
      <button type="button" class="menu" aria-label="Revenir au menu principal" @click="flipped = false">
        <LayoutGrid :size="20" aria-hidden="true" />
        <span class="name">Menu</span>
      </button>
      <div class="subs" role="tablist" :aria-label="shown.label">
        <span class="indicator" aria-hidden="true"><span /></span>
        <button
          v-for="it in shown.items"
          :key="it.id"
          type="button"
          role="tab"
          class="tab"
          :aria-selected="it.id === shown.current"
          :aria-current="it.id === shown.current ? 'page' : undefined"
          @click="pick(it.id)"
        >
          <span class="icon">
            <component :is="SUB_ICONS[it.icon] ?? Sparkles" :size="20" aria-hidden="true" />
            <span v-if="it.dot" class="dot" aria-label="à faire" />
          </span>
          <span class="name">{{ it.label }}</span>
        </button>
      </div>
    </div>
  </nav>
</template>

<style scoped>
.tabbar {
  --h: 74px;
  position: fixed;
  z-index: 20;
  left: 50%;
  bottom: calc(env(safe-area-inset-bottom) + 12px);
  transform: translateX(-50%);
  width: min(calc(100% - 32px), 448px);
  height: var(--h);
  animation: bar-in 0.7s var(--ease-spring) 0.2s backwards;
}

@keyframes bar-in {
  from {
    opacity: 0;
    transform: translate(-50%, 40px) scale(0.92);
  }
}

/*
 * Les deux faces tournent autour du même axe, placé une demi-hauteur derrière elles :
 * c'est un rouleau. Chaque face porte sa propre perspective, pour que le flou d'arrière-plan
 * continue de fonctionner sur iPhone (il casse dans une vraie scène 3D).
 */
.face {
  position: absolute;
  inset: 0;
  display: grid;
  padding: 8px 6px;
  border-radius: var(--r-tab, 36px);
  background: var(--tab-bg);
  border: 1px solid var(--tab-border);
  -webkit-backdrop-filter: blur(30px) saturate(180%);
  backdrop-filter: blur(30px) saturate(180%);
  box-shadow:
    0 18px 40px -10px rgba(0, 0, 0, 0.65),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  transform-origin: 50% 50% calc(var(--h) / -2);
  -webkit-backface-visibility: hidden;
  backface-visibility: hidden;
  transition:
    transform 0.7s var(--ease-spring),
    opacity 0.3s ease,
    visibility 0s linear 0s;
}

.front {
  grid-template-columns: repeat(5, 1fr);
  transform: perspective(900px) rotateX(0deg);
}

.back {
  grid-template-columns: 58px 1fr;
  gap: 4px;
  transform: perspective(900px) rotateX(-90deg);
  opacity: 0;
  visibility: hidden;
  transition-delay: 0s, 0.25s, 0.7s;
}

.flipped .front {
  transform: perspective(900px) rotateX(90deg);
  opacity: 0;
  visibility: hidden;
  transition-delay: 0s, 0.25s, 0.7s;
}

.flipped .back {
  transform: perspective(900px) rotateX(0deg);
  opacity: 1;
  visibility: visible;
  transition-delay: 0s;
}

.subs {
  position: relative;
  display: grid;
  grid-template-columns: repeat(var(--n), 1fr);
  min-width: 0;
}

.indicator {
  position: absolute;
  top: 4px;
  left: 0;
  width: calc(100% / var(--n));
  height: 30px;
  display: flex;
  justify-content: center;
  transform: translateX(calc(var(--i) * 100%));
  transition: transform 0.5s var(--ease-spring), opacity 0.2s ease;
  pointer-events: none;
}

.front .indicator {
  top: 12px;
  left: 6px;
  width: calc((100% - 12px) / var(--n));
}

.indicator span {
  width: 48px;
  height: 30px;
  border-radius: var(--r-pill, 15px);
  background: var(--tab-active);
  box-shadow: var(--primary-shadow), inset 0 1px 0 rgba(255, 255, 255, 0.3);
}

.indicator.hidden {
  opacity: 0;
}

.tab,
.menu {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  min-width: 0;
  min-height: 56px;
  padding: 4px 0 0;
  border: 0;
  background: none;
  color: var(--muted);
  font: inherit;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.01em;
  border-radius: var(--r-ctrl);
  cursor: pointer;
  transition: color 0.25s ease;
}

.name {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.icon {
  position: relative;
  display: grid;
  place-items: center;
  width: 48px;
  height: 30px;
  transition: transform 0.15s ease, color 0.25s ease;
}

.tab:active .icon,
.menu:active svg {
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
.tab[aria-current='page'] .icon > svg:first-child {
  animation: pop 0.5s var(--ease-spring) 0.08s;
}

/* Signale que l'onglet actif a des rubriques : le toucher fait pivoter la barre */
.has-sub {
  position: absolute;
  right: 2px;
  bottom: 1px;
  opacity: 0.75;
}

/* Bouton de retour au menu principal, séparé des rubriques par un filet */
.menu {
  justify-content: flex-start;
  color: var(--ink-2);
}

.menu svg {
  width: 48px;
  height: 30px;
  padding: 5px 14px;
  border-radius: var(--r-pill, 15px);
  background: var(--surface-2);
  transition: transform 0.15s ease;
}

.menu::after {
  content: '';
  position: absolute;
  top: 8px;
  bottom: 8px;
  right: -3px;
  width: 1px;
  background: var(--line-strong);
}

.dot {
  position: absolute;
  top: 3px;
  right: 8px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--ko);
  box-shadow: 0 0 0 2px var(--bg), 0 0 8px var(--ko);
}

@media (prefers-reduced-motion: reduce) {
  .face {
    transform: none !important;
  }
}
</style>
