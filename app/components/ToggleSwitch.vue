<script setup lang="ts">
const model = defineModel<boolean>({ required: true })
defineProps<{ label: string }>()
</script>

<template>
  <button
    type="button"
    role="switch"
    class="switch"
    :aria-checked="model"
    :aria-label="label"
    @click="model = !model"
  >
    <span class="knob" />
  </button>
</template>

<style scoped>
.switch {
  position: relative;
  flex-shrink: 0;
  width: 52px;
  height: 32px;
  padding: 0;
  border: 0;
  border-radius: var(--r-pill, 16px);
  background: var(--line-strong);
  cursor: pointer;
  transition: background 0.2s ease;
}

.switch[aria-checked='true'] {
  background: var(--primary);
}

.knob {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 26px;
  height: 26px;
  border-radius: var(--r-knob, 50%);
  background: var(--ink);
  transition: transform 0.2s ease;
}

.switch[aria-checked='true'] .knob {
  transform: translateX(20px);
  background: var(--on-primary);
}

/* Zone tactile de 44 px autour d'un interrupteur de 32 px */
.switch::after {
  content: '';
  position: absolute;
  inset: -6px;
}
</style>
