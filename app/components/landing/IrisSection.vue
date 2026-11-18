<script setup lang="ts">
/*
 * Moment « iris-opens » (taste-skill) : la section a son propre fond, bord à bord.
 * Par-dessus, un panneau dans l'ancien fond s'ouvre en disque au fil du défilement,
 * avec un fin anneau d'accent ; le contenu apparaît en entier une fois le disque ouvert.
 * Mouvements réduits : la section directement ouverte.
 */
const root = ref<HTMLElement>()
const p = ref(1)
let raf = 0

function update() {
  raf = 0
  const el = root.value
  if (!el) return
  const r = el.getBoundingClientRect()
  const vh = window.innerHeight
  // 0 quand le haut de la section entre par le bas, 1 quand il arrive au cinquième de l'écran
  const t = (vh * 0.95 - r.top) / (vh * 0.75)
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
  <section ref="root" class="iris" :style="{ '--p': eased }" :class="{ open: p > 0.85 }">
    <div class="content">
      <slot />
    </div>
    <div class="cover" aria-hidden="true">
      <span class="ring" />
    </div>
  </section>
</template>

<style scoped>
.iris {
  position: relative;
  /* Fond propre, bord à bord dans la colonne de l'appli */
  margin: 24px -20px 0;
  padding: 40px 20px;
  background:
    radial-gradient(120% 70% at 50% 0%, color-mix(in srgb, var(--primary-solid) 22%, transparent), transparent 70%),
    var(--surface);
  border-block: 1px solid var(--surface-border);
  overflow: hidden;
}

.content {
  position: relative;
  transition: opacity 0.6s var(--ease-out), transform 0.6s var(--ease-out);
}

.iris:not(.open) .content {
  opacity: 0;
  transform: translateY(12px);
}

/* Panneau dans l'ancien fond (gouttière égale, coins de carte), percé d'un disque qui s'élargit */
.cover {
  position: absolute;
  inset: 12px;
  border-radius: var(--r-card);
  background: var(--bg);
  pointer-events: none;
  mask: radial-gradient(circle at 50% 45%, transparent calc(var(--p) * 120%), #000 calc(var(--p) * 120% + 1px));
  -webkit-mask: radial-gradient(circle at 50% 45%, transparent calc(var(--p) * 120%), #000 calc(var(--p) * 120% + 1px));
  opacity: calc(1 - max(0, var(--p) - 0.92) * 12);
}

.ring {
  position: absolute;
  left: 50%;
  top: 45%;
  width: calc(var(--p) * 240%);
  aspect-ratio: 1;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  border: 1.5px solid var(--accent-text);
  opacity: calc(0.9 - var(--p) * 0.6);
}

@media (prefers-reduced-motion: reduce) {
  .cover {
    display: none;
  }

  .iris .content {
    opacity: 1 !important;
    transform: none !important;
  }
}
</style>
