<script setup lang="ts">
import { Check } from 'lucide-vue-next'

const { message } = useToast()
</script>

<template>
  <div class="toast-zone" role="status" aria-live="polite">
    <Transition name="toast">
      <p v-if="message" class="toast card">
        <Check :size="18" aria-hidden="true" />
        {{ message }}
      </p>
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
  margin: 0;
  padding: 14px 16px;
  font-weight: 600;
  background: var(--surface-2);
}

.toast svg {
  color: var(--ok);
}

.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
