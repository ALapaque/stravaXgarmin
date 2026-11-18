<script setup lang="ts">
/** Nombre qui défile jusqu'à sa valeur à l'affichage (et quand elle change). */
const props = withDefaults(defineProps<{ value: number; decimals?: number; duration?: number; delay?: number }>(), {
  decimals: 0,
  duration: 900,
  delay: 150,
})

const shown = ref(props.value)
let frame = 0

function animate(from: number, to: number, delay = 0) {
  cancelAnimationFrame(frame)
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    shown.value = to
    return
  }
  const start = performance.now() + delay
  const tick = (now: number) => {
    const t = Math.min(Math.max((now - start) / props.duration, 0), 1)
    const eased = 1 - Math.pow(1 - t, 3)
    shown.value = from + (to - from) * eased
    if (t < 1) frame = requestAnimationFrame(tick)
  }
  shown.value = from
  frame = requestAnimationFrame(tick)
}

onMounted(() => animate(0, props.value, props.delay))
watch(() => props.value, (to) => animate(shown.value, to))
onBeforeUnmount(() => cancelAnimationFrame(frame))

const final = computed(() =>
  props.value.toLocaleString('fr-BE', { minimumFractionDigits: props.decimals, maximumFractionDigits: props.decimals }),
)

const text = computed(() =>
  shown.value.toLocaleString('fr-BE', {
    minimumFractionDigits: props.decimals,
    maximumFractionDigits: props.decimals,
  }),
)
</script>

<template>
  <span><span aria-hidden="true">{{ text }}</span><span class="sr-only">{{ final }}</span></span>
</template>
