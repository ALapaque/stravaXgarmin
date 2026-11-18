<script setup lang="ts">
/* Charge : kilomètres par semaine sur 8 semaines, avec alerte si la hausse est trop rapide. */
import { TriangleAlert, TrendingUp, TrendingDown } from 'lucide-vue-next'

const { weeks, ramp } = useFitness()
const max = computed(() => Math.max(...weeks.value.map((w) => w.km), 1))
const any = computed(() => weeks.value.some((w) => w.km > 0))
</script>

<template>
  <section v-if="any" class="card card--pad load" aria-labelledby="load-title">
    <div class="section-head">
      <h2 id="load-title" class="eyebrow">Charge · km par semaine</h2>
      <span v-if="ramp" class="trend" :class="{ high: ramp.high }">
        <component :is="ramp.pct >= 0 ? TrendingUp : TrendingDown" :size="14" aria-hidden="true" />
        {{ ramp.pct > 0 ? '+' : '' }}{{ ramp.pct }} %
      </span>
    </div>
    <ol class="bars">
      <li v-for="(w, i) in weeks" :key="w.from" :style="{ '--i': i }" :aria-label="`Semaine du ${w.label} : ${formatKm(w.km)} km`">
        <span class="v">{{ w.km ? Math.round(w.km) : '' }}</span>
        <span class="b" :class="{ now: w.current, off: !w.km }" :style="{ height: `${w.km ? Math.max((w.km / max) * 100, 8) : 4}%` }" />
        <span class="l">{{ w.label }}</span>
      </li>
    </ol>
    <p v-if="ramp?.high" class="alert" role="status">
      <TriangleAlert :size="18" aria-hidden="true" />
      <span>
        <strong>Charge en forte hausse.</strong>
        {{ formatKm(ramp.now) }} km sur 7 jours, contre {{ formatKm(ramp.before) }} km par semaine d’habitude. Au-delà de +30 %, le risque de blessure monte : lève le pied quelques jours.
      </span>
    </p>
  </section>
</template>

<style scoped>
.load {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.trend {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 9px;
  border-radius: 99px;
  font-size: 12px;
  font-weight: 700;
  color: var(--ok);
  background: color-mix(in srgb, var(--ok) 15%, transparent);
}

.trend.high {
  color: var(--ko);
  background: color-mix(in srgb, var(--ko) 15%, transparent);
}

.bars {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 6px;
  height: 130px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.bars li {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  gap: 5px;
  height: 100%;
  min-width: 0;
}

.v {
  font-size: 11px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--ink-2);
}

.b {
  width: 100%;
  max-width: 30px;
  border-radius: calc(var(--r-ctrl) / 2 + 2px) calc(var(--r-ctrl) / 2 + 2px) 2px 2px;
  background: linear-gradient(180deg, var(--type-long), color-mix(in srgb, var(--type-long) 25%, transparent));
  transform-origin: bottom;
  animation: grow 0.7s var(--ease-spring) backwards;
  animation-delay: calc(150ms + var(--i) * 50ms);
}

.b.now {
  background: var(--primary);
  box-shadow: 0 0 18px -4px var(--primary-solid);
}

.b.off {
  background: var(--line-strong);
}

.l {
  font-size: 10px;
  font-weight: 600;
  color: var(--muted);
  white-space: nowrap;
}

.alert {
  display: flex;
  gap: 10px;
  margin: 0;
  padding: 12px;
  border-radius: var(--r-ctrl);
  font-size: 14px;
  color: var(--ink-2);
  background: color-mix(in srgb, var(--ko) 12%, transparent);
}

.alert svg {
  flex-shrink: 0;
  margin-top: 2px;
  color: var(--ko);
}
</style>
