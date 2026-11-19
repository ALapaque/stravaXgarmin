<script setup lang="ts">
/*
 * Onglets d'un écran : une rangée de pastilles avec un fond qui glisse vers l'onglet choisi.
 * Reste collée en haut pendant le défilement. Flèches gauche/droite au clavier.
 */
export interface TabItem {
  id: string
  label: string
  /** Petit point d'attention (quelque chose à faire dans cet onglet) */
  dot?: boolean
}

const props = defineProps<{ tabs: TabItem[]; modelValue: string; label: string }>()
const emit = defineEmits<{ 'update:modelValue': [id: string] }>()

const index = computed(() => Math.max(props.tabs.findIndex((t) => t.id === props.modelValue), 0))
const buttons = ref<HTMLButtonElement[]>([])

function go(i: number, focus = false) {
  const t = props.tabs[(i + props.tabs.length) % props.tabs.length]
  if (!t) return
  emit('update:modelValue', t.id)
  if (focus) nextTick(() => buttons.value[(i + props.tabs.length) % props.tabs.length]?.focus())
}
</script>

<template>
  <div class="tabs-wrap">
    <div class="tabs" role="tablist" :aria-label="label" :style="{ '--n': tabs.length, '--i': index }">
      <span class="thumb" aria-hidden="true" />
      <button
        v-for="(t, i) in tabs"
        :key="t.id"
        ref="buttons"
        type="button"
        role="tab"
        :aria-selected="t.id === modelValue"
        :tabindex="t.id === modelValue ? 0 : -1"
        @click="go(i)"
        @keydown.right.prevent="go(i + 1, true)"
        @keydown.left.prevent="go(i - 1, true)"
      >
        {{ t.label }}
        <span v-if="t.dot" class="dot" aria-label="à faire" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.tabs-wrap {
  position: sticky;
  top: calc(env(safe-area-inset-top) + 6px);
  z-index: 15;
  margin: 0 -4px;
}

.tabs {
  position: relative;
  display: grid;
  grid-template-columns: repeat(var(--n), 1fr);
  padding: 4px;
  border-radius: calc(var(--r-ctrl) + 4px);
  background: var(--tab-bg);
  border: 1px solid var(--tab-border);
  -webkit-backdrop-filter: blur(24px) saturate(160%);
  backdrop-filter: blur(24px) saturate(160%);
  box-shadow: 0 10px 24px -14px rgba(0, 0, 0, 0.6);
}

/* Fond de l'onglet actif : glisse d'un onglet à l'autre */
.thumb {
  position: absolute;
  top: 4px;
  bottom: 4px;
  left: 4px;
  width: calc((100% - 8px) / var(--n));
  border-radius: var(--r-ctrl);
  background: var(--tab-active);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.25);
  transform: translateX(calc(var(--i) * 100%));
  transition: transform 0.45s var(--ease-spring);
}

button {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 42px;
  padding: 0 4px;
  border: 0;
  background: none;
  color: var(--muted);
  font: inherit;
  font-size: 14px;
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
  transition: color 0.25s ease, transform 0.12s ease;
}

button:active {
  transform: scale(0.95);
}

button[aria-selected='true'] {
  color: var(--on-tab-active);
}

button:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: -2px;
  border-radius: var(--r-ctrl);
}

.dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--ko);
  box-shadow: 0 0 8px var(--ko);
}
</style>
