<script setup lang="ts">
/*
 * Moment « iris-opens » (taste-skill) : au fil du défilement, un disque s'ouvre sur le
 * nouveau fond de la section, bordé d'un fin anneau d'accent ; le contenu apparaît en
 * entier une fois le disque ouvert. Uniquement clip-path et transform (fluide sur iPhone).
 * Mouvements réduits : la section directement ouverte.
 */
const root = ref<HTMLElement>()
const p = ref(1)
// Distance du centre du disque (50 %, 40 %) au coin le plus loin : le disque et l'anneau s'y arrêtent
const reach = ref(600)
let raf = 0

function update() {
  raf = 0
  const el = root.value
  if (!el) return
  const r = el.getBoundingClientRect()
  reach.value = Math.hypot(r.width / 2, r.height * 0.6) + 2
  const vh = window.innerHeight
  // 0 quand le haut de la section entre par le bas, 1 quand il arrive vers le quart de l'écran
  const t = (vh * 0.95 - r.top) / (vh * 0.7)
  p.value = Math.min(Math.max(t, 0), 1)
}

function onScroll() {
  if (!raf) raf = requestAnimationFrame(update)
}

onMounted(() => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  update()
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', onScroll)
})
onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll)
  window.removeEventListener('resize', onScroll)
  cancelAnimationFrame(raf)
})

const eased = computed(() => 1 - Math.pow(1 - p.value, 3))
</script>

<template>
  <section ref="root" class="iris" :style="{ '--p': eased.toFixed(4), '--reach': `${reach}px` }" :class="{ open: p > 0.8 }">
    <div class="disc" aria-hidden="true" />
    <span class="ring" aria-hidden="true" />
    <div class="content">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.iris {
  position: relative;
  isolation: isolate;
  margin: 24px -20px 0;
  padding: 40px 20px;
  overflow: hidden;
}

/* Nouveau fond, découvert par un disque qui s'agrandit */
.disc {
  position: absolute;
  inset: 0;
  z-index: -1;
  background:
    radial-gradient(120% 70% at 50% 0%, color-mix(in srgb, var(--primary-solid) 22%, transparent), transparent 70%),
    var(--surface);
  border-block: 1px solid var(--surface-border);
  clip-path: circle(calc(var(--p) * var(--reach)) at 50% 40%);
  will-change: clip-path;
}

/* Anneau d'accent au bord du disque, agrandi par transform seulement */
.ring {
  position: absolute;
  z-index: -1;
  left: 50%;
  top: 40%;
  width: calc(var(--reach) * 2);
  height: calc(var(--reach) * 2);
  border-radius: 50%;
  border: 2px solid var(--accent-text);
  transform: translate(-50%, -50%) scale(var(--p));
  opacity: calc(0.8 - var(--p) * 0.8);
  will-change: transform, opacity;
  pointer-events: none;
}

.content {
  transition: opacity 0.6s var(--ease-out), transform 0.6s var(--ease-out);
}

.iris:not(.open) .content {
  opacity: 0;
  transform: translateY(12px);
}

/* Grand écran : la section n'est plus bord à bord, elle devient un grand panneau */
@media (min-width: 720px) {
  .iris {
    margin: 48px 0 0;
    padding: 64px 48px;
    border-radius: calc(var(--r-card) + 8px);
  }

  .disc {
    border: 1px solid var(--surface-border);
    border-radius: inherit;
  }
}

@media (prefers-reduced-motion: reduce) {
  .ring {
    display: none;
  }

  .disc {
    clip-path: none;
  }

  .iris .content {
    opacity: 1 !important;
    transform: none !important;
  }
}
</style>
