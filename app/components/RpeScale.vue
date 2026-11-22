<script setup lang="ts">
/*
 * Échelle de ressenti de 1 à 10 : dix cases à toucher, une jauge qui monte du plus facile (--ok) au plus
 * dur (--ko) en passant par l'accent du thème, et la valeur en grand avec son mot.
 * Groupe de boutons radio : Tab entre dans le groupe, les flèches changent la valeur (Début, Fin aussi).
 */
const model = defineModel<number | null>({ required: true })
const props = withDefaults(defineProps<{ label?: string }>(), { label: 'Ton ressenti, de 1 à 10' })

const values = Array.from({ length: 10 }, (_, i) => i + 1)
const cells = ref<HTMLButtonElement[]>([])
// La case qui reçoit le focus au clavier : la valeur choisie, sinon la première
const focusable = computed(() => model.value ?? 1)
const bump = ref(0)

function pick(v: number, focus = false) {
  if (model.value !== v) {
    model.value = v
    bump.value++
    // Petite vibration quand le téléphone le permet
    try {
      navigator.vibrate?.(8)
    } catch {
      /* ignore */
    }
  }
  if (focus) nextTick(() => cells.value[v - 1]?.focus())
}

function onKey(e: KeyboardEvent) {
  const cur = model.value ?? 0
  let next: number | null = null
  if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = Math.min(10, cur + 1)
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = Math.max(1, cur - 1 || 1)
  else if (e.key === 'Home') next = 1
  else if (e.key === 'End') next = 10
  if (next === null) return
  e.preventDefault()
  pick(next, true)
}

const tint = computed(() => rpeTint(model.value))
</script>

<template>
  <div class="rpe" :style="{ '--tint': tint }">
    <div class="readout" aria-hidden="true">
      <span v-if="model" :key="`n${bump}`" class="value num">{{ model }}</span>
      <span v-else class="value value--empty" />
      <span class="word">
        <span class="title">{{ model ? RPE_LABELS[model] : 'Comment c’était ?' }}</span>
        <span class="label">{{ model ? 'sur 10' : 'Touche une case, de 1 à 10' }}</span>
      </span>
    </div>
    <div class="cells" role="radiogroup" :aria-label="props.label" @keydown="onKey">
      <button
        v-for="v in values"
        :key="v"
        ref="cells"
        type="button"
        role="radio"
        class="cell"
        :class="{ on: model !== null && v <= model, current: v === model }"
        :style="{ '--c': rpeTint(v), '--h': `${30 + v * 7}%`, '--i': v }"
        :aria-checked="v === model"
        :aria-label="`${v} sur 10, ${RPE_LABELS[v]}`"
        :tabindex="v === focusable ? 0 : -1"
        @click="pick(v)"
      >
        <span class="fill" />
        <span class="n">{{ v }}</span>
      </button>
    </div>
    <div class="ends" aria-hidden="true">
      <span>Très facile</span>
      <span>Maximal</span>
    </div>
  </div>
</template>

<style scoped>
.rpe {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.readout {
  display: flex;
  align-items: center;
  gap: 16px;
  min-height: 76px;
}

.value {
  min-width: 1.15em;
  font-size: 76px;
  color: var(--tint);
  transition: color 0.3s ease;
  animation: pop 0.45s var(--ease-spring);
  text-shadow: 0 0 34px color-mix(in srgb, var(--tint) 35%, transparent);
}

/* Pas encore de note : un emplacement vide, à la taille du chiffre */
.value--empty {
  width: 56px;
  height: 64px;
  border: 2px dashed var(--line-strong);
  border-radius: var(--r-ctrl);
  animation: none;
}

.word {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.word .title {
  font-family: var(--font-display);
  font-size: 22px;
  line-height: 1.15;
}

.cells {
  display: grid;
  grid-template-columns: repeat(10, minmax(0, 1fr));
  gap: 5px;
}

.cell {
  position: relative;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  height: 52px;
  min-width: 0;
  padding: 0 0 6px;
  border: 1px solid var(--line-strong);
  border-radius: calc(var(--r-ctrl) * 0.6);
  background: transparent;
  overflow: hidden;
  cursor: pointer;
  transition: border-color 0.2s ease, transform 0.15s var(--ease-spring);
}

.cell:active {
  transform: scale(0.92);
}

/* La jauge : chaque case un peu plus haute que la précédente */
.fill {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: var(--h);
  background: color-mix(in srgb, var(--c) 14%, transparent);
  transform-origin: bottom;
  transition: background 0.25s ease;
}

.cell.on {
  border-color: color-mix(in srgb, var(--c) 70%, transparent);
}

.cell.on .fill {
  background: linear-gradient(180deg, var(--c), color-mix(in srgb, var(--c) 55%, transparent));
  animation: grow 0.4s var(--ease-spring) backwards;
  animation-delay: calc(var(--i) * 18ms);
}

.cell.current {
  border-color: var(--c);
  box-shadow: 0 0 0 1px var(--c), 0 6px 20px -6px var(--c);
  animation: pop 0.4s var(--ease-spring);
}

.n {
  position: relative;
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 700;
  color: var(--muted);
}

.cell.on .n {
  color: var(--bg);
}

.ends {
  display: flex;
  justify-content: space-between;
  margin-top: -6px;
  font-size: 12px;
  color: var(--muted);
}
</style>
