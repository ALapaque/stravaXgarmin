<script setup lang="ts">
/*
 * Aperçu vivant de l'appli dans un téléphone, sur l'écran Aujourd'hui : la séance d'hier attend son débrief
 * (tours sur tapis, 5 efforts sur 8), puis le « Course à pied en soirée » devient le nom de la séance et le
 * débrief est fait. Dessous : la semaine face au plan, la prochaine séance, la barre à trois onglets.
 * Trois tours, puis il se pose.
 */
import { NotebookText, Sunrise, TrendingUp } from 'lucide-vue-next'

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

/* Tours de la séance sur tapis : échauffement, 8 efforts (5 tenus), retour au calme */
const LAPS = [
  { h: 34, w: 3 }, { h: 92, w: 1 }, { h: 30, w: 1 }, { h: 94, w: 1 }, { h: 30, w: 1 }, { h: 90, w: 1 }, { h: 30, w: 1 },
  { h: 93, w: 1 }, { h: 30, w: 1 }, { h: 88, w: 1 }, { h: 30, w: 1 }, { h: 88, w: 1, ghost: true }, { h: 30, w: 1, ghost: true },
  { h: 88, w: 1, ghost: true }, { h: 30, w: 1, ghost: true }, { h: 88, w: 1, ghost: true }, { h: 28, w: 2 },
]
/* La semaine : fait, fait, sauté, fait, hier (à débriefer), aujourd'hui prévu, demain prévu */
const WEEK = [
  { d: 'L', s: 'done' }, { d: 'M', s: 'done' }, { d: 'M', s: 'skip' }, { d: 'J', s: 'done' }, { d: 'V', s: 'done' }, { d: 'S', s: 'plan', today: true }, { d: 'D', s: 'plan' },
]
const TABS = [
  { icon: Sunrise, label: 'Aujourd’hui', on: true },
  { icon: NotebookText, label: 'Journal' },
  { icon: TrendingUp, label: 'Progression' },
]
</script>

<template>
  <div class="phone" aria-hidden="true">
    <div class="glow" />
    <div class="frame">
      <div class="notch" />
      <div class="screen">
        <p class="hello">Salut <span class="masked">Alex</span></p>

        <!-- Carte principale : la séance d'hier, à débriefer -->
        <div class="focus">
          <Transition name="swap" mode="out-in">
            <span :key="String(fixed)" class="lbl">{{ fixed ? 'Débriefée · hier' : 'À débriefer · hier' }}</span>
          </Transition>
          <Transition name="swap" mode="out-in">
            <b :key="String(fixed)" class="name">{{ fixed ? '8×400m (R=1’)' : 'Course à pied en soirée' }}</b>
          </Transition>
          <div class="laps">
            <span v-for="(l, i) in LAPS" :key="i" class="lap" :class="{ ghost: l.ghost }" :style="{ height: `${l.h}%`, flexGrow: l.w, '--b': i }" />
          </div>
          <div class="foot">
            <span class="res">5 efforts sur 8 · sur tapis</span>
            <Transition name="swap" mode="out-in">
              <span :key="String(fixed)" class="cta" :class="{ done: fixed }">{{ fixed ? 'Publié ✓' : 'Débriefer' }}</span>
            </Transition>
          </div>
        </div>

        <!-- Ta semaine, face au plan -->
        <div class="week">
          <span class="wk-head"><b>Ta semaine</b><small>4 séances sur 5</small></span>
          <div class="days">
            <span v-for="(d, i) in WEEK" :key="i" class="day" :class="{ today: d.today }">
              <span class="mark" :class="`m-${d.s}`" />
              <span class="d">{{ d.d }}</span>
            </span>
          </div>
        </div>

        <div class="rows">
          <div class="r">
            <span class="tile" style="--tile: var(--type-interval)" />
            <span class="txt"><b>Fractionné 6 × 800 m</b><small>Demain · 55 min · Kiprun</small></span>
          </div>
        </div>

        <div class="tabs">
          <span v-for="t in TABS" :key="t.label" class="t" :class="{ on: t.on }">
            <component :is="t.icon" :size="12" />
            <span>{{ t.label }}</span>
          </span>
        </div>
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

.focus {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 11px 12px 10px;
  border-radius: calc(var(--r-card) * 0.7);
  background: var(--primary);
  color: var(--on-primary);
}

.lbl {
  font-family: var(--font-mono);
  font-size: 8.5px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  opacity: 0.85;
}

.name {
  font-family: var(--font-display);
  font-weight: var(--display-weight);
  font-size: 15px;
  line-height: 1.15;
  letter-spacing: -0.02em;
}

/* Profil des tours (tapis) : les 3 derniers efforts, non faits, en fantôme */
.laps {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 34px;
  margin-top: 2px;
}

.lap {
  flex-basis: 0;
  border-radius: 2px 2px 1px 1px;
  background: currentColor;
  opacity: 0.92;
  transform-origin: bottom;
  animation: grow 0.6s var(--ease-out) backwards;
  animation-delay: calc(900ms + var(--b) * 35ms);
}

.lap.ghost {
  opacity: 0.28;
}

.foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  margin-top: 2px;
}

.res {
  font-family: var(--font-mono);
  font-size: 8.5px;
  opacity: 0.85;
}

.cta {
  padding: 4px 8px;
  border-radius: var(--r-pill);
  font-size: 9px;
  font-weight: 800;
  color: var(--ink);
  background: var(--bg);
}

.cta.done {
  color: var(--ok);
}

/* Ta semaine */
.week {
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding: 10px;
  border-radius: calc(var(--r-card) * 0.62);
  background: var(--surface);
  border: 1px solid var(--surface-border);
}

.wk-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.wk-head b {
  font-size: 10.5px;
  font-weight: 700;
}

.wk-head small {
  font-family: var(--font-mono);
  font-size: 8px;
  color: var(--muted);
}

.days {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 3px;
}

.day {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 3px 0;
  border-radius: calc(var(--r-ctrl) * 0.6);
}

.day.today {
  background: var(--surface-2);
}

.mark {
  width: 11px;
  height: 11px;
  border-radius: 50%;
}

.m-done {
  background: var(--ok);
}

.m-plan {
  box-shadow: inset 0 0 0 1.5px var(--ink-2);
}

.m-skip {
  position: relative;
}

.m-skip::before,
.m-skip::after {
  content: '';
  position: absolute;
  inset: 5px 1px;
  border-radius: 1px;
  background: var(--muted);
  transform: rotate(45deg);
}

.m-skip::after {
  transform: rotate(-45deg);
}

.d {
  font-family: var(--font-mono);
  font-size: 7.5px;
  color: var(--muted);
}

.rows {
  border-radius: calc(var(--r-card) * 0.62);
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
  border-radius: calc(var(--r-ctrl) * 0.5);
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


/* Barre du bas : trois onglets */
.tabs {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
  padding: 5px;
  margin-top: 2px;
  border-radius: calc(var(--r-tab) * 0.56);
  background: var(--tab-bg);
  border: 1px solid var(--tab-border);
}

.t {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 5px 0 4px;
  border-radius: calc(var(--r-tab) * 0.42);
  font-size: 7.5px;
  font-weight: 700;
  color: var(--muted);
}

.t.on {
  color: var(--on-tab-active);
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
