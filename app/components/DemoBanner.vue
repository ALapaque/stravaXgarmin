<script setup lang="ts">
const { active, exit } = useDemo()
</script>

<template>
  <Transition name="banner">
    <div v-if="active" class="banner" role="status">
      <span class="dot" aria-hidden="true" />
      <span class="text"><strong>Mode démo</strong> · données fictives</span>
      <button type="button" class="quit" @click="exit">Quitter</button>
    </div>
  </Transition>
</template>

<style scoped>
.banner {
  position: sticky;
  top: 0;
  z-index: 25;
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 auto;
  max-width: 480px;
  padding: calc(env(safe-area-inset-top) + 8px) 20px 8px;
  font-size: 14px;
  color: #1a1206;
  /* Rayures « chantier » : impossible de confondre avec de vraies données */
  background: repeating-linear-gradient(-45deg, #ffcf3f 0 14px, #ffc21a 14px 28px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35);
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #1a1206;
  animation: blink 1.6s ease-in-out infinite;
}

.text {
  flex: 1;
}

.quit {
  min-height: 36px;
  padding: 0 14px;
  border: 0;
  border-radius: 10px;
  background: #1a1206;
  color: #ffcf3f;
  font-weight: 700;
  cursor: pointer;
}

@keyframes blink {
  50% {
    opacity: 0.3;
  }
}

.banner-enter-active,
.banner-leave-active {
  transition: transform 0.35s var(--ease-out), opacity 0.25s ease;
}

.banner-enter-from,
.banner-leave-to {
  transform: translateY(-100%);
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .dot {
    animation: none;
  }
}
</style>
