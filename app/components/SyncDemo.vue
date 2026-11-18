<script setup lang="ts">
/** Animation de la page d'accueil : un nom générique Strava remplacé par le vrai nom Garmin. */
const EXAMPLES = [
  { garmin: 'Fractionné piste 10×400', before: 'Morning Run' },
  { garmin: 'Sortie longue 18 km · Bois', before: 'Afternoon Run' },
  { garmin: 'Tempo 8 km à 4:41 /km', before: 'Evening Run' },
]

const i = ref(0)
const typed = ref(EXAMPLES[0]!.garmin)
const phase = ref<'before' | 'typing' | 'done'>('done')
let timers: ReturnType<typeof setTimeout>[] = []

const ex = computed(() => EXAMPLES[i.value]!)

function later(fn: () => void, ms: number) {
  timers.push(setTimeout(fn, ms))
}

function cycle() {
  phase.value = 'before'
  typed.value = ''
  later(() => {
    phase.value = 'typing'
    const target = ex.value.garmin
    target.split('').forEach((_, k) => later(() => (typed.value = target.slice(0, k + 1)), k * 38))
    later(() => (phase.value = 'done'), target.length * 38 + 120)
    later(() => {
      i.value = (i.value + 1) % EXAMPLES.length
      cycle()
    }, target.length * 38 + 2600)
  }, 1100)
}

onMounted(() => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  later(cycle, 1800)
})
onBeforeUnmount(() => timers.forEach(clearTimeout))
</script>

<template>
  <div class="card list demo" aria-hidden="true">
    <div class="row">
      <BrandMark brand="garmin" :size="36" />
      <span class="row__main">
        <span class="label">Garmin Connect</span>
        <Transition name="fade" mode="out-in">
          <span :key="ex.garmin" class="title">{{ ex.garmin }}</span>
        </Transition>
      </span>
    </div>
    <div class="row">
      <BrandMark brand="strava" :size="36" />
      <span class="row__main">
        <span class="label">Strava</span>
        <span class="title strava-name">
          <s v-if="phase === 'before'">{{ ex.before }}</s>
          <template v-else>{{ typed }}<span v-if="phase === 'typing'" class="caret" /></template>
        </span>
      </span>
      <Transition name="pop">
        <StatusChip v-if="phase === 'done'" ok label="Copié" />
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.strava-name s {
  color: var(--muted);
}

.caret {
  display: inline-block;
  width: 2px;
  height: 1em;
  margin-left: 1px;
  vertical-align: -2px;
  background: var(--accent-text);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.pop-enter-active {
  animation: pop 0.45s var(--ease-spring);
}

.pop-leave-active {
  transition: opacity 0.2s ease;
}

.pop-leave-to {
  opacity: 0;
}
</style>
