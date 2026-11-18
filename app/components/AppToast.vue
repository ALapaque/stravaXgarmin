<script setup lang="ts">
import { Check } from 'lucide-vue-next'

const { message, action, dismiss } = useToast()

function runAction() {
  const act = action.value
  dismiss()
  act?.run()
}
</script>

<template>
  <div class="toast-zone" role="status" aria-live="polite">
    <Transition name="toast">
      <div v-if="message" :key="message" class="toast card">
        <Check :size="18" aria-hidden="true" />
        <span class="text">{{ message }}</span>
        <button v-if="action" type="button" class="act" @click="runAction">{{ action.label }}</button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.toast-zone {
  position: fixed;
  z-index: 30;
  left: 50%;
  bottom: calc(env(safe-area-inset-bottom) + 100px);
  transform: translateX(-50%);
  width: min(calc(100% - 32px), 448px);
  pointer-events: none;
}

.toast {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 8px 8px 16px;
  min-height: 56px;
  font-weight: 600;
  background: var(--surface-2);
  pointer-events: auto;
}

.toast > svg {
  flex-shrink: 0;
  color: var(--ok);
}

.text {
  flex: 1;
}

.act {
  min-height: 40px;
  padding: 0 14px;
  border: 0;
  border-radius: var(--r-ctrl);
  background: color-mix(in srgb, var(--accent-text) 16%, transparent);
  color: var(--accent-text);
  font-weight: 700;
  cursor: pointer;
}

.toast-enter-active {
  transition: opacity 0.25s ease, transform 0.35s var(--ease-spring);
}

.toast-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.toast-enter-from {
  opacity: 0;
  transform: translateY(16px) scale(0.96);
}

.toast-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
