<script setup lang="ts">
/*
 * Aperçu vivant de l'appli dans un téléphone : les barres poussent, le total défile,
 * puis un « Morning Run » devient le vrai nom Garmin. Trois tours, puis il se pose.
 */
const fixed = ref(false)
let round = 0
let timer: ReturnType<typeof setTimeout> | undefined

function play() {
  fixed.value = false
  timer = setTimeout(() => {
    fixed.value = true
    round++
    if (round < 3) timer = setTimeout(play, 3200)
  }, 2400)
}

onMounted(() => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    fixed.value = true
    return
  }
  play()
})
onBeforeUnmount(() => clearTimeout(timer))

const BARS = [0, 0, 0, 100, 50, 64, 0]
const DAYS = ['J', 'V', 'S', 'D', 'L', 'M', 'M']
</script>

<template>
  <div class="phone" aria-hidden="true">
    <div class="glow" />
    <div class="frame">
      <div class="notch" />
      <div class="screen">
        <p class="hello">Salut <span class="masked">Alex</span></p>
        <div class="week">
          <span class="lbl">7 derniers jours</span>
          <span class="km"><CountUp :value="26.6" :decimals="1" :delay="900" :duration="1200" /> km</span>
          <div class="bars">
            <span v-for="(h, i) in BARS" :key="i" class="bar-col">
              <span class="bar" :class="{ off: !h }" :style="{ height: `${h || 10}%`, '--b': i }" />
              <span class="d">{{ DAYS[i] }}</span>
            </span>
          </div>
        </div>
        <div class="rows">
          <div class="r">
            <span class="tile" style="--tile: var(--type-interval)" />
            <span class="txt">
              <Transition name="swap" mode="out-in">
                <b :key="String(fixed)">{{ fixed ? 'Fractionné piste 10×400' : 'Morning Run' }}</b>
              </Transition>
              <small>8,0 km · 42:30</small>
            </span>
            <Transition name="swap" mode="out-in">
              <span :key="String(fixed)" class="chip" :class="fixed ? 'chip--ok' : 'chip--ko'">{{ fixed ? 'Synchro' : 'Différent' }}</span>
            </Transition>
          </div>
          <div class="r">
            <span class="tile" style="--tile: var(--type-recovery)" />
            <span class="txt"><b>Footing récup</b><small>6,2 km · 35:01</small></span>
            <span class="chip chip--ok">Synchro</span>
          </div>
          <div class="r">
            <span class="tile" style="--tile: var(--type-long)" />
            <span class="txt"><b>Sortie longue</b><small>12,4 km · 1:05:12</small></span>
            <span class="chip chip--ok">Synchro</span>
          </div>
        </div>
        <div class="tabs"><i class="on" /><i /><i /><i /></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.phone {
  position: relative;
  display: grid;
  place-items: center;
  padding: 12px 0 4px;
  /* Le téléphone se pose : léger zoom arrière à l'arrivée */
  animation: settle 1.1s var(--ease-out) 0.35s backwards;
}

@keyframes settle {
  from {
    opacity: 0;
    transform: translateY(24px) scale(1.05);
  }
}

.glow {
  position: absolute;
  inset: 8% 10%;
  background: var(--primary);
  filter: blur(60px);
  opacity: 0.45;
  border-radius: 50%;
}

.frame {
  position: relative;
  width: 252px;
  padding: 10px;
  border-radius: 42px;
  background: #11131f;
  border: 1px solid rgba(255, 255, 255, 0.14);
  box-shadow: 0 30px 60px rgba(0, 0, 0, 0.55), inset 0 0 0 2px #1d2133;
}

.notch {
  position: absolute;
  top: 18px;
  left: 50%;
  width: 72px;
  height: 20px;
  transform: translateX(-50%);
  border-radius: 12px;
  background: #000;
  z-index: 2;
}

.screen {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 40px 12px 12px;
  border-radius: 33px;
  background: var(--bg);
  overflow: hidden;
  font-size: 11px;
}

.hello {
  margin: 0;
  font-family: var(--font-display);
  font-weight: var(--display-weight);
  font-size: 17px;
  letter-spacing: -0.02em;
}

.masked {
  filter: blur(5px);
}

.week {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 12px;
  border-radius: 18px;
  background: var(--primary);
  color: var(--on-primary);
}

.lbl {
  font-family: var(--font-mono);
  font-size: 9px;
  opacity: 0.8;
}

.km {
  font-family: var(--font-display);
  font-weight: var(--display-weight);
  font-size: 30px;
  letter-spacing: -0.04em;
  line-height: 1.1;
}

.bars {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 5px;
  height: 46px;
  margin-top: 6px;
}

.bar-col {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  align-items: center;
  gap: 3px;
}

.bar {
  width: 100%;
  max-width: 16px;
  border-radius: 4px;
  background: currentColor;
  transform-origin: bottom;
  animation: grow 0.7s var(--ease-out) backwards;
  animation-delay: calc(900ms + var(--b) * 60ms);
}

.bar.off {
  opacity: 0.25;
  max-height: 4px;
}

.d {
  font-family: var(--font-mono);
  font-size: 8px;
  opacity: 0.75;
}

.rows {
  border-radius: 16px;
  background: var(--surface);
  border: 1px solid var(--surface-border);
}

.r {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 10px;
}

.r + .r {
  border-top: 1px solid var(--line);
}

.r .tile {
  width: 24px;
  height: 24px;
  border-radius: 7px;
}

.txt {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.txt b {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-weight: 600;
  font-size: 11px;
}

.txt small {
  font-family: var(--font-mono);
  font-size: 8.5px;
  color: var(--muted);
}

.r .chip {
  padding: 3px 6px;
  font-size: 8.5px;
  gap: 3px;
}

.r .chip::before {
  width: 4px;
  height: 4px;
}

.tabs {
  display: flex;
  justify-content: space-around;
  padding: 10px 8px;
  margin-top: 2px;
  border-radius: 20px;
  background: var(--tab-bg);
  border: 1px solid var(--tab-border);
}

.tabs i {
  width: 22px;
  height: 12px;
  border-radius: 6px;
  background: var(--line-strong);
}

.tabs i.on {
  background: var(--tab-active);
}

.swap-enter-active,
.swap-leave-active {
  transition: opacity 0.25s ease, transform 0.3s var(--ease-out);
}

.swap-enter-from {
  opacity: 0;
  transform: translateY(6px);
}

.swap-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
