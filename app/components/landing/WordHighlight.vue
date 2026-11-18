<script setup lang="ts">
/*
 * Moment « word-highlight » (taste-skill) : la phrase repose à demi-teinte et
 * s'allume mot à mot en passant le milieu de l'écran ; les mots forts prennent l'accent.
 * Repart en arrière quand on remonte. Mouvements réduits : la phrase entière, allumée.
 */
const props = defineProps<{ text: string; strong?: string[] }>()

const words = computed(() =>
  props.text.split(' ').map((w) => ({ w, strong: props.strong?.some((s) => w.toLowerCase().includes(s.toLowerCase())) })),
)

const root = ref<HTMLElement>()
const lit = ref(0)
let raf = 0

function update() {
  raf = 0
  const el = root.value
  if (!el) return
  const line = window.innerHeight * 0.6
  const spans = el.querySelectorAll<HTMLElement>('.w')
  let n = 0
  spans.forEach((s) => {
    if (s.getBoundingClientRect().top < line) n++
  })
  lit.value = n
}

function onScroll() {
  if (!raf) raf = requestAnimationFrame(update)
}

onMounted(() => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    lit.value = Infinity
    return
  }
  update()
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', onScroll)
})
onBeforeUnmount(() => {
  window.removeEventListener('scroll', onScroll)
  window.removeEventListener('resize', onScroll)
  cancelAnimationFrame(raf)
})
</script>

<template>
  <p ref="root" class="statement">
    <template v-for="(x, i) in words" :key="i">
      <span class="w" :class="{ on: i < lit, strong: x.strong }">{{ x.w }}</span>{{ ' ' }}
    </template>
  </p>
</template>

<style scoped>
.statement {
  margin: 0;
  font-family: var(--font-display);
  font-weight: var(--display-weight);
  font-size: clamp(28px, 8.4vw, 36px);
  line-height: 1.15;
  letter-spacing: var(--tracking-display);
}

.w {
  color: var(--ink);
  opacity: 0.32;
  transition: opacity 0.35s ease, color 0.35s ease;
}

.w.on {
  opacity: 1;
}

.w.strong.on {
  color: var(--accent-text);
}
</style>
