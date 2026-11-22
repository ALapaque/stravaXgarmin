<script setup lang="ts">
/* Issue de la séance en trois grandes cartes : icône, mot, une ligne d'explication. Groupe radio. */
import { CircleCheckBig, CircleDotDashed, CircleX } from 'lucide-vue-next'
import type { Outcome } from '#shared/utils/compliance'

const model = defineModel<Outcome>({ required: true })
defineProps<{ label?: string }>()

const OPTIONS: { id: Outcome; icon: unknown; hint: string; tone: string }[] = [
  { id: 'done', icon: CircleCheckBig, hint: 'Tout le programme', tone: 'var(--ok)' },
  { id: 'short', icon: CircleDotDashed, hint: 'Une partie du programme', tone: 'var(--accent-text)' },
  { id: 'failed', icon: CircleX, hint: 'Arrêtée trop tôt', tone: 'var(--ko)' },
]
const uid = useId()
</script>

<template>
  <div class="outcomes" role="radiogroup" :aria-label="label ?? 'Issue de la séance'">
    <label v-for="o in OPTIONS" :key="o.id" class="opt" :class="{ on: model === o.id }" :style="{ '--tone': o.tone }">
      <input v-model="model" class="sr-only" type="radio" :name="`outcome-${uid}`" :value="o.id">
      <span class="ico" aria-hidden="true"><component :is="o.icon" :size="22" /></span>
      <span class="word">{{ OUTCOME_LABELS[o.id] }}</span>
      <span class="hint">{{ o.hint }}</span>
    </label>
  </div>
</template>

<style scoped>
.outcomes {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.opt {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  min-width: 0;
  min-height: 112px;
  padding: 12px 10px;
  border: 1px solid var(--line-strong);
  border-radius: var(--r-ctrl);
  background: transparent;
  cursor: pointer;
  transition: border-color 0.2s ease, background 0.2s ease, transform 0.15s var(--ease-spring);
}

.opt:active {
  transform: scale(0.97);
}

.opt:has(:focus-visible) {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
}

.ico {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: var(--r-knob);
  color: var(--muted);
  background: var(--surface-2);
  transition: color 0.2s ease, background 0.2s ease;
}

.word {
  margin-top: auto;
  font-family: var(--font-display);
  font-weight: var(--title-weight);
  font-size: 16px;
  line-height: 1.1;
  letter-spacing: -0.01em;
}

.hint {
  font-size: 11.5px;
  line-height: 1.3;
  color: var(--muted);
}

.opt.on {
  border-color: var(--tone);
  background: color-mix(in srgb, var(--tone) 12%, transparent);
  box-shadow: inset 0 0 0 1px var(--tone);
}

.opt.on .ico {
  color: var(--bg);
  background: var(--tone);
  animation: pop 0.4s var(--ease-spring);
}

.opt.on .word {
  color: var(--tone);
}
</style>
