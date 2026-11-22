<script setup lang="ts">
/*
 * Barre du bas à deux faces, qui tourne comme un rouleau.
 * - Face avant : les trois onglets (icône + nom), avec un indicateur qui glisse.
 * - Face arrière : quand l'écran a des rubriques (Journal, Progression, Réglages), la barre pivote pour les
 *   montrer. À gauche, les AUTRES onglets en petit (un seul toucher pour changer d'onglet), un filet,
 *   puis les rubriques avec leur point d'attention.
 * On ne reste jamais bloqué : la face arrière donne toujours accès aux autres onglets, quitter un écran
 * à rubriques ramène la face avant, et toucher l'onglet actif (face avant) rouvre les rubriques.
 * Contrainte iPhone : chaque face porte sa propre perspective() (pas de preserve-3d, qui casse le flou).
 */
import { Layers, Sparkles } from 'lucide-vue-next'
import type { Subnav } from '~/composables/useSubnav'

const route = useRoute()
const { active, sub, pick } = useNav()

// Dernier sous-menu connu : il reste dessiné pendant que la barre revient au menu principal
const shown = ref<Subnav | null>(sub.value)
const flipped = ref(false)
let flipTimer: ReturnType<typeof setTimeout> | undefined
let leaveTimer: ReturnType<typeof setTimeout> | undefined

onMounted(() => {
  watch(
    () => sub.value?.key,
    (key) => {
      clearTimeout(flipTimer)
      clearTimeout(leaveTimer)
      if (key) {
        shown.value = sub.value
        // Déjà sur la face arrière (d'un écran à rubriques à un autre) : les rubriques changent sur place.
        // Sinon, on laisse l'écran arriver, puis la barre pivote vers ses rubriques.
        if (!flipped.value) flipTimer = setTimeout(() => (flipped.value = true), 280)
      } else {
        // L'écran suivant pose ses rubriques juste après le départ du précédent : on attend un instant
        // avant de revenir au menu, pour ne pas faire un aller-retour inutile entre deux écrans à rubriques.
        leaveTimer = setTimeout(() => (flipped.value = false), 90)
      }
    },
    { immediate: true },
  )
})
watch(sub, (s) => {
  if (s) shown.value = s
}, { deep: true })
onBeforeUnmount(() => {
  clearTimeout(flipTimer)
  clearTimeout(leaveTimer)
})

const subIndex = computed(() => Math.max(shown.value?.items.findIndex((i) => i.id === shown.value?.current) ?? 0, 0))
/** Les autres onglets, en petit sur la face arrière (les trois quand aucun n'est actif, sur les réglages) */
const others = computed(() => NAV.map((t, i) => ({ ...t, i })).filter((t) => t.i !== active.value))

function onMain(i: number, e: MouseEvent) {
  // Onglet déjà ouvert et écran à rubriques : on rouvre le sous-menu au lieu de recharger
  if (i === active.value && sub.value && route.path === NAV[i]!.to) {
    e.preventDefault()
    flipped.value = true
  }
}
</script>

<template>
  <nav class="tabbar" :class="{ flipped }" :aria-label="flipped && shown ? shown.label : 'Navigation principale'">
    <!-- Face avant : les trois onglets -->
    <div class="face front" :inert="flipped || undefined" :style="{ '--i': Math.max(active, 0), '--n': NAV.length }">
      <span class="lozenge" :class="{ hidden: active < 0 }" aria-hidden="true" />
      <NuxtLink
        v-for="(t, i) in NAV"
        :key="t.to"
        :to="t.to"
        class="tab"
        :aria-current="i === active ? 'page' : undefined"
        @click="onMain(i, $event)"
      >
        <span class="icon">
          <component :is="t.icon" :size="22" aria-hidden="true" />
          <Layers v-if="i === active && sub" class="has-sub" :size="11" aria-label="rubriques disponibles" />
        </span>
        <span class="name">{{ t.label }}</span>
      </NuxtLink>
    </div>

    <!-- Face arrière : les autres onglets en petit, puis les rubriques de l'écran -->
    <div v-if="shown" class="face back" :inert="!flipped || undefined">
      <div class="minis" :style="{ '--m': others.length }">
        <NuxtLink v-for="t in others" :key="t.to" :to="t.to" class="mini" :aria-label="t.label" :title="t.label">
          <component :is="t.icon" :size="19" aria-hidden="true" />
        </NuxtLink>
      </div>
      <Transition name="swap" mode="out-in">
        <div :key="shown.key" class="subs" role="tablist" :aria-label="shown.label" :style="{ '--i': subIndex, '--n': shown.items.length }">
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
      </Transition>
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
  grid-template-columns: repeat(var(--n), 1fr);
  transform: perspective(900px) rotateX(0deg);
}

.back {
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  padding-left: 8px;
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

/* ── Face avant : une pastille qui glisse derrière l'onglet actif (icône et nom) ── */
.lozenge {
  position: absolute;
  top: 8px;
  bottom: 8px;
  left: 6px;
  width: calc((100% - 12px) / var(--n));
  border-radius: max(calc(var(--r-tab, 36px) - 8px), var(--r-pill, 15px));
  transform: translateX(calc(var(--i) * 100%));
  transition: transform 0.55s var(--ease-spring), opacity 0.25s ease;
  pointer-events: none;
}

/* La couleur vit dans un pseudo-élément : l'arrondi s'applique à la zone utile (sans les marges) */
.lozenge::before {
  content: '';
  position: absolute;
  inset: 0 6px;
  border-radius: inherit;
  background: var(--tab-active);
  box-shadow: var(--primary-shadow), inset 0 1px 0 rgba(255, 255, 255, 0.3);
}

.lozenge.hidden {
  opacity: 0;
  transform: translateX(calc(var(--i) * 100%)) scale(0.6);
}

.tab {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  min-width: 0;
  min-height: 56px;
  padding: 0;
  border: 0;
  background: none;
  color: var(--muted);
  font: inherit;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.01em;
  border-radius: var(--r-ctrl);
  cursor: pointer;
  transition: color 0.3s ease;
}

.front .tab {
  gap: 4px;
  font-size: 12px;
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
  height: 26px;
  transition: transform 0.15s ease, color 0.25s ease;
}

.tab:active .icon,
.mini:active svg {
  transform: scale(0.88);
}

.front .tab[aria-current='page'] {
  color: var(--on-tab-active);
  font-weight: 700;
}

/* Petit rebond de l'icône quand l'onglet devient actif */
.tab[aria-current='page'] .icon > svg:first-child {
  animation: pop 0.5s var(--ease-spring) 0.08s;
}

/* Signale que l'onglet actif a des rubriques : le toucher fait pivoter la barre */
.has-sub {
  position: absolute;
  right: 4px;
  bottom: 0;
  opacity: 0.8;
}

/* ── Face arrière ── */
.minis {
  position: relative;
  display: flex;
  gap: 2px;
  padding-right: 9px;
}

/* Filet entre les autres onglets et les rubriques */
.minis::after {
  content: '';
  position: absolute;
  top: 6px;
  bottom: 6px;
  right: 0;
  width: 1px;
  background: var(--line-strong);
}

.mini {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: var(--r-pill, 15px);
  color: var(--ink-2);
  transition: color 0.2s ease, background 0.2s ease;
}

/* À chaque pivot vers les rubriques, les petits onglets arrivent l'un après l'autre */
.flipped .mini {
  animation: mini-in 0.5s var(--ease-spring) 0.3s backwards;
}

.flipped .mini:nth-child(2) {
  animation-delay: 0.36s;
}

.flipped .mini:nth-child(3) {
  animation-delay: 0.42s;
}

@keyframes mini-in {
  from {
    opacity: 0;
    transform: scale(0.6);
  }
}

.mini svg {
  box-sizing: content-box;
  padding: 7px;
  border-radius: inherit;
  background: var(--surface-2);
  box-shadow: inset 0 0 0 1px var(--line);
  transition: transform 0.15s ease;
}

.mini:hover {
  color: var(--ink);
}

.subs {
  position: relative;
  display: grid;
  grid-template-columns: repeat(var(--n), minmax(0, 1fr));
  min-width: 0;
}

.indicator {
  position: absolute;
  top: 2px;
  left: 0;
  width: calc(100% / var(--n));
  height: 26px;
  display: flex;
  justify-content: center;
  transform: translateX(calc(var(--i) * 100%));
  transition: transform 0.5s var(--ease-spring), opacity 0.2s ease;
  pointer-events: none;
}

.indicator span {
  width: min(48px, 100%);
  height: 26px;
  border-radius: var(--r-pill, 15px);
  background: var(--tab-active);
  box-shadow: var(--primary-shadow), inset 0 1px 0 rgba(255, 255, 255, 0.3);
}

.subs .tab {
  justify-content: flex-start;
  padding-top: 2px;
}

.subs .tab[aria-current='page'] {
  color: var(--ink);
  font-weight: 700;
}

.subs .tab[aria-current='page'] .icon {
  color: var(--on-tab-active);
}

.dot {
  position: absolute;
  top: 1px;
  right: calc(50% - 18px);
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--ko);
  box-shadow: 0 0 0 2px var(--bg), 0 0 8px var(--ko);
}

/* D'un écran à rubriques à un autre : les rubriques changent sur place */
.swap-enter-active {
  transition: opacity 0.25s ease, transform 0.45s var(--ease-spring);
}

.swap-leave-active {
  transition: opacity 0.12s ease, transform 0.12s ease;
}

.swap-enter-from {
  opacity: 0;
  transform: translateY(10px);
}

.swap-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

@media (prefers-reduced-motion: reduce) {
  .face {
    transform: none !important;
  }
}
</style>
