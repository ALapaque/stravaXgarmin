<template>
  <!-- Fond vivant : lumières colorées qui dérivent lentement, grain de pellicule et vignettage -->
  <div class="aurora" aria-hidden="true">
    <span class="blob b1" />
    <span class="blob b2" />
    <span class="blob b3" />
    <span class="blob b4" />
  </div>
</template>

<style scoped>
.aurora {
  position: fixed;
  inset: 0;
  z-index: -1;
  overflow: hidden;
  pointer-events: none;
  background: var(--bg);
}

.blob {
  position: absolute;
  width: 90vmax;
  height: 90vmax;
  max-width: 900px;
  max-height: 900px;
  border-radius: 50%;
  opacity: var(--aurora-strength, 0.5);
  will-change: transform;
}

.b1 {
  top: -45vmax;
  left: -40vmax;
  background: radial-gradient(closest-side, var(--aurora-1), transparent 72%);
  animation: drift-a 26s ease-in-out infinite alternate;
}

.b2 {
  top: -30vmax;
  right: -50vmax;
  background: radial-gradient(closest-side, var(--aurora-3), transparent 70%);
  animation: drift-b 32s ease-in-out infinite alternate;
}

.b3 {
  top: 10vmax;
  left: -60vmax;
  opacity: calc(var(--aurora-strength, 0.5) * 0.6);
  background: radial-gradient(closest-side, var(--aurora-2), transparent 70%);
  animation: drift-b 38s ease-in-out -12s infinite alternate;
}

.b4 {
  bottom: -60vmax;
  right: -40vmax;
  opacity: calc(var(--aurora-strength, 0.5) * 0.55);
  background: radial-gradient(closest-side, var(--aurora-4), transparent 70%);
  animation: drift-a 30s ease-in-out -8s infinite alternate;
}

@keyframes drift-a {
  to {
    transform: translate(12vmax, 8vmax) scale(1.15);
  }
}

@keyframes drift-b {
  to {
    transform: translate(-10vmax, 12vmax) scale(0.9);
  }
}

/* Grain et vignettage : la profondeur d'une image plutôt qu'un aplat */
.aurora::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(120% 80% at 50% 0%, transparent 40%, var(--bg) 100%);
}

.aurora::after {
  content: '';
  position: absolute;
  inset: -50%;
  opacity: 0.07;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  mix-blend-mode: overlay;
}

@media (prefers-reduced-motion: reduce) {
  .blob {
    animation: none;
  }
}
</style>
