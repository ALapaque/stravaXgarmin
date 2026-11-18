<script setup lang="ts">
import { RotateCcw, Check, ArrowRight, Heart } from 'lucide-vue-next'
import { DEFAULT_LOOK, FONTS, RADII, type CustomLook } from '~/composables/useTheme'

useHead({ title: 'Apparence · stravaXgarmin' })

const { theme, themes, look, customized } = useTheme()
const { show } = useToast()

const ACCENTS = ['#ff5a1f', '#ff2e93', '#ff3b3b', '#ffb020', '#d4ff3a', '#16e08a', '#00e0c6', '#00c2ff', '#2b6bff', '#8b7bff', '#f5f5f0']

function set<K extends keyof CustomLook>(key: K, value: CustomLook[K]) {
  look.value = { ...look.value, [key]: value }
}

const accentInput = computed({
  get: () => look.value.accent ?? '#ff5a1f',
  set: (v: string) => set('accent', v),
})
const accent2Input = computed({
  get: () => look.value.accent2 ?? look.value.accent ?? '#ff2e93',
  set: (v: string) => set('accent2', v),
})
const aurora = computed({
  get: () => look.value.aurora ?? -1,
  set: (v: number) => set('aurora', Number(v)),
})

function reset() {
  look.value = { ...DEFAULT_LOOK }
  show('Apparence du thème rétablie')
}

const radiusOptions = [
  { id: 'theme', label: 'Thème' },
  ...Object.entries(RADII).map(([id, r]) => ({ id, label: r.label })),
] as { id: CustomLook['radius']; label: string }[]
const fontOptions = [
  { id: 'theme', label: 'Celle du thème', family: 'var(--font-display)' },
  ...Object.entries(FONTS).map(([id, f]) => ({ id, label: f.label, family: f.display })),
] as { id: CustomLook['font']; label: string; family: string }[]
</script>

<template>
  <div class="stack">
    <BackLink to="/reglages" label="Réglages" />
    <div class="title-block">
      <p class="eyebrow">Ton appli, ton style</p>
      <h1 class="h1 h1--xl">Apparence</h1>
    </div>

    <!-- Aperçu : change en direct avec chaque réglage -->
    <section class="card preview" aria-label="Aperçu">
      <div class="p-top">
        <div>
          <p class="eyebrow">Aperçu</p>
          <p class="num p-num">12,4<span class="unit">km</span></p>
        </div>
        <span class="chip chip--ok">Synchro</span>
      </div>
      <div class="p-row">
        <span class="tile" style="--tile: var(--accent-text)" aria-hidden="true"><Heart :size="20" /></span>
        <span class="row__main">
          <span class="title">Sortie longue du dimanche</span>
          <span class="label">5:15 /km · 148 bpm</span>
        </span>
        <ToggleSwitch :model-value="true" label="Exemple d’interrupteur" />
      </div>
      <button type="button" class="btn btn--primary" tabindex="-1">Bouton principal <ArrowRight :size="20" aria-hidden="true" /></button>
    </section>

    <h2 id="base-title" class="eyebrow group">Thème de base</h2>
    <div class="bases" role="radiogroup" aria-labelledby="base-title">
      <label v-for="t in themes" :key="t.id" class="base" :class="{ on: theme === t.id }">
        <input v-model="theme" class="sr-only" type="radio" name="base" :value="t.id">
        <span class="dots" :style="{ background: t.bg }" aria-hidden="true">
          <span v-for="c in t.swatch" :key="c" :style="{ background: c }" />
        </span>
        <span class="base-name">{{ t.label }}</span>
      </label>
    </div>

    <h2 id="accent-title" class="eyebrow group">Couleur d’accent</h2>
    <div class="card card--pad block-ctl">
      <div class="swatches" role="radiogroup" aria-labelledby="accent-title">
        <button type="button" class="sw sw--theme" role="radio" :aria-checked="!look.accent" @click="look = { ...look, accent: null, accent2: null }">
          Thème
        </button>
        <button
          v-for="c in ACCENTS"
          :key="c"
          type="button"
          class="sw"
          role="radio"
          :aria-checked="look.accent === c"
          :aria-label="`Couleur ${c}`"
          :style="{ '--sw': c }"
          @click="set('accent', c)"
        >
          <Check v-if="look.accent === c" :size="16" aria-hidden="true" />
        </button>
        <label class="sw sw--pick" :style="{ '--sw': accentInput }">
          <span class="sr-only">Choisir une couleur libre</span>
          <input v-model="accentInput" type="color">
        </label>
      </div>

      <div v-if="look.accent" class="line">
        <span class="row__main">
          <span class="title">Dégradé</span>
          <span class="hint">Une deuxième couleur pour les boutons et le fond</span>
        </span>
        <label v-if="look.accent2" class="sw sw--pick" :style="{ '--sw': accent2Input }">
          <span class="sr-only">Deuxième couleur</span>
          <input v-model="accent2Input" type="color">
        </label>
        <ToggleSwitch
          :model-value="Boolean(look.accent2)"
          label="Dégradé"
          @update:model-value="(on: boolean) => set('accent2', on ? '#ff2e93' : null)"
        />
      </div>
    </div>

    <h2 class="eyebrow group">Arrondis</h2>
    <div class="segmented" role="group" aria-label="Arrondis">
      <button v-for="r in radiusOptions" :key="r.id" type="button" :aria-pressed="look.radius === r.id" @click="set('radius', r.id)">
        {{ r.label }}
      </button>
    </div>

    <h2 id="font-title" class="eyebrow group">Police</h2>
    <div class="fonts" role="radiogroup" aria-labelledby="font-title">
      <button
        v-for="f in fontOptions"
        :key="f.id"
        type="button"
        class="card font"
        role="radio"
        :aria-checked="look.font === f.id"
        :class="{ on: look.font === f.id }"
        @click="set('font', f.id)"
      >
        <span class="sample" :style="{ fontFamily: `${f.family}, system-ui, sans-serif` }">Aa 42,2</span>
        <span class="hint">{{ f.label }}</span>
      </button>
    </div>

    <h2 class="eyebrow group">Fond animé</h2>
    <div class="card card--pad block-ctl">
      <label class="line">
        <span class="row__main">
          <span class="title">Intensité des lumières</span>
          <span class="hint">{{ look.aurora === null ? 'Celle du thème' : look.aurora === 0 ? 'Éteint' : `${look.aurora} %` }}</span>
        </span>
      </label>
      <input v-model.number="aurora" class="range" type="range" min="0" max="100" step="5" aria-label="Intensité du fond animé">
    </div>

    <button v-if="customized" type="button" class="btn btn--secondary" @click="reset">
      <RotateCcw :size="18" aria-hidden="true" /> Revenir au thème d’origine
    </button>
  </div>
</template>

<style scoped>
.title-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.group {
  margin-top: 6px;
  color: var(--accent-text);
}

.hint {
  font-size: 14px;
  color: var(--muted);
}

/* ── Aperçu ── */
.preview {
  position: sticky;
  top: calc(env(safe-area-inset-top) + 8px);
  z-index: 5;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 18px;
  -webkit-backdrop-filter: blur(30px);
  backdrop-filter: blur(30px);
}

.p-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.p-num {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin: 6px 0 0;
  font-size: 46px;
  background: var(--primary);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.unit {
  font-size: 16px;
}

.p-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* ── Thème de base ── */
.bases {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.base {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 10px 6px;
  border-radius: var(--r-ctrl);
  border: 2px solid transparent;
  background: var(--surface-2);
  cursor: pointer;
  transition: border-color 0.2s ease, transform 0.15s ease;
}

.base:active {
  transform: scale(0.96);
}

.base.on {
  border-color: var(--primary-solid);
}

.base:has(input:focus-visible) {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
}

.dots {
  display: flex;
  gap: 3px;
  padding: 5px;
  border-radius: 99px;
  border: 1px solid var(--line-strong);
}

.dots span {
  width: 14px;
  height: 14px;
  border-radius: 50%;
}

.base-name {
  font-size: 13px;
  font-weight: 700;
}

/* ── Couleurs ── */
.block-ctl {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.swatches {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.sw {
  position: relative;
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: var(--sw);
  color: #0a0a0a;
  cursor: pointer;
  transition: transform 0.15s var(--ease-spring);
}

.sw:active {
  transform: scale(0.88);
}

.sw[aria-checked='true'] {
  box-shadow: 0 0 0 3px var(--bg), 0 0 0 5px var(--sw, var(--ink));
}

.sw--theme {
  width: auto;
  padding: 0 14px;
  border-radius: 99px;
  background: var(--surface-2);
  color: var(--ink);
  font-size: 13px;
  font-weight: 700;
}

/* Pastille arc-en-ciel : couleur libre */
.sw--pick {
  overflow: hidden;
  background: conic-gradient(#ff3b3b, #ffb020, #d4ff3a, #00e0c6, #2b6bff, #ff2e93, #ff3b3b);
}

.sw--pick::after {
  content: '';
  position: absolute;
  inset: 9px;
  border-radius: 50%;
  background: var(--sw);
  box-shadow: 0 0 0 2px var(--bg);
  pointer-events: none;
}

.sw--pick input {
  position: absolute;
  inset: -10px;
  width: 200%;
  height: 200%;
  opacity: 0;
  cursor: pointer;
}

.line {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* ── Polices ── */
.fonts {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.font {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: 14px;
  color: var(--ink);
  text-align: left;
  cursor: pointer;
  transition: box-shadow 0.2s ease, transform 0.15s ease;
}

.font:active {
  transform: scale(0.97);
}

.font.on {
  box-shadow: 0 0 0 2px var(--primary-solid);
}

.sample {
  font-size: 26px;
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.2;
}

/* ── Curseur ── */
.range {
  width: 100%;
  height: 32px;
  margin: 0;
  accent-color: var(--primary-solid);
}
</style>
