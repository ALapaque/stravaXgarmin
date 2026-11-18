<script setup lang="ts">
/* Forme vue par la montre Garmin : VO2max, statut, préparation, récupération, temps prédits. */
import { Activity, BatteryCharging, Gauge, Timer } from 'lucide-vue-next'

const { forme } = useFitness()
const f = computed(() => forme.value?.data)
const TONE = { ok: 'var(--ok)', warn: 'var(--accent-text)', ko: 'var(--ko)', idle: 'var(--info)' }
const READY: Record<string, string> = { PRIME: 'Au top', HIGH: 'Élevée', MODERATE: 'Correcte', LOW: 'Basse', POOR: 'Très basse' }
const preds = computed(() => GOAL_DISTANCES.map((d) => ({ ...d, time: f.value?.predictions?.[d.id] ?? null })).filter((d) => d.time))
const has = computed(() => Boolean(f.value && (f.value.vo2max || f.value.status || f.value.readiness || f.value.recoveryHours !== null || preds.value.length)))
</script>

<template>
  <section v-if="has && f" class="forme" aria-labelledby="forme-title">
    <div class="section-head">
      <h2 id="forme-title" class="h2">Ta forme</h2>
      <span class="label">via Garmin</span>
    </div>

    <dl class="grid-2 tiles">
      <div v-if="f.vo2max" class="card t">
        <dt class="eyebrow"><Gauge :size="13" aria-hidden="true" /> VO2max</dt>
        <dd class="num"><CountUp :value="f.vo2max" :decimals="f.vo2max % 1 ? 1 : 0" /></dd>
      </div>
      <div v-if="f.status" class="card t" :style="{ '--k': TONE[f.status.tone] }">
        <dt class="eyebrow"><Activity :size="13" aria-hidden="true" /> Statut</dt>
        <dd class="word">{{ f.status.label }}</dd>
        <span v-if="f.load" class="sub">charge {{ f.load.acute }}<template v-if="f.load.chronic"> · habituelle {{ f.load.chronic }}</template></span>
      </div>
      <div v-if="f.readiness" class="card t">
        <dt class="eyebrow"><BatteryCharging :size="13" aria-hidden="true" /> Préparation</dt>
        <dd class="num"><CountUp :value="f.readiness.score" :delay="150" /><span class="unit">/100</span></dd>
        <span class="sub">{{ READY[f.readiness.level] ?? '' }}</span>
        <span class="gauge" aria-hidden="true"><span :style="{ width: `${f.readiness.score}%` }" /></span>
      </div>
      <div v-if="f.recoveryHours !== null" class="card t">
        <dt class="eyebrow"><Timer :size="13" aria-hidden="true" /> Récupération</dt>
        <dd class="num">{{ f.recoveryHours }}<span class="unit">h</span></dd>
        <span class="sub">{{ f.recoveryHours ? 'avant une séance dure' : 'Prêt pour une séance dure' }}</span>
      </div>
    </dl>

    <div v-if="preds.length" class="card preds">
      <p class="eyebrow">Temps prédits</p>
      <dl class="pred-row">
        <div v-for="p in preds" :key="p.id">
          <dt>{{ p.label }}</dt>
          <dd class="num">{{ formatDuration(Math.round(p.time!)) }}</dd>
        </div>
      </dl>
    </div>
  </section>
</template>

<style scoped>
.forme {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.tiles {
  margin: 0;
  gap: 10px;
}

.t {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 16px;
  min-height: 112px;
}

.t dt {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--k, var(--muted));
}

.t dd {
  display: flex;
  align-items: baseline;
  gap: 4px;
  margin: 0;
  font-size: 34px;
}

.t dd.word {
  font-family: var(--font-display);
  font-weight: var(--display-weight);
  font-size: 22px;
  line-height: 1.15;
  letter-spacing: -0.02em;
  color: var(--k, var(--ink));
}

.unit {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0;
  color: var(--muted);
}

.sub {
  font-size: 13px;
  color: var(--muted);
}

.gauge {
  margin-top: auto;
  height: 6px;
  border-radius: 99px;
  background: var(--line-strong);
  overflow: hidden;
}

.gauge span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--primary);
  transform-origin: left;
  animation: fill 0.9s var(--ease-out) 0.3s backwards;
}

@keyframes fill {
  from {
    transform: scaleX(0);
  }
}

.preds {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
}

.pred-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(70px, 1fr));
  gap: 10px;
  margin: 0;
}

.pred-row div {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.pred-row dt {
  font-size: 12px;
  font-weight: 700;
  color: var(--muted);
}

.pred-row dd {
  margin: 0;
  font-size: 19px;
}
</style>
