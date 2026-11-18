<script setup lang="ts">
/* Chaussures : kilométrage par paire (Strava) et usure par rapport à la limite choisie. */
import { Footprints, TriangleAlert } from 'lucide-vue-next'

const { shoes } = useFitness()
const settings = useSettings()
</script>

<template>
  <section v-if="shoes.length" class="shoes" aria-labelledby="shoes-title">
    <div class="section-head">
      <h2 id="shoes-title" class="h2">Tes chaussures</h2>
      <span class="label">usées à {{ settings.shoeLimitKm }} km</span>
    </div>
    <ul class="card list">
      <li v-for="(s, i) in shoes" :key="s.id" class="row shoe" :style="{ '--i': i }">
        <span class="tile" :style="{ '--tile': s.worn ? 'var(--ko)' : s.soon ? 'var(--accent-text)' : 'var(--ok)' }" aria-hidden="true">
          <component :is="s.worn ? TriangleAlert : Footprints" :size="22" />
        </span>
        <span class="row__main">
          <span class="top">
            <span class="title">{{ s.name }}</span>
            <span class="num km">{{ s.km }}<span class="unit">km</span></span>
          </span>
          <span class="bar" :class="{ worn: s.worn, soon: s.soon && !s.worn }" aria-hidden="true"><span :style="{ width: `${Math.round(s.wear * 100)}%` }" /></span>
          <span class="hint">
            {{ s.worn ? 'À remplacer : l’amorti n’est plus au niveau' : s.soon ? `Encore ${settings.shoeLimitKm - s.km} km environ` : `${Math.round(s.wear * 100)} % de leur vie` }}<template v-if="s.primary"> · paire principale</template>
          </span>
        </span>
      </li>
    </ul>
    <label class="limit">
      <span class="fine">Seuil d’usure</span>
      <input v-model.number="settings.shoeLimitKm" type="range" min="400" max="1000" step="50" aria-label="Seuil d’usure en kilomètres">
    </label>
  </section>
</template>

<style scoped>
.shoes {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.shoe {
  align-items: flex-start;
  padding-block: 16px;
}

.row__main {
  gap: 8px;
}

.top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
}

.km {
  flex-shrink: 0;
  font-size: 20px;
}

.unit {
  margin-left: 3px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0;
  color: var(--muted);
}

.bar {
  height: 8px;
  border-radius: 99px;
  background: var(--line-strong);
  overflow: hidden;
}

.bar span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--ok);
  transform-origin: left;
  animation: fill 0.9s var(--ease-out) backwards;
  animation-delay: calc(250ms + var(--i) * 120ms);
}

.bar.soon span {
  background: var(--accent-text);
}

.bar.worn span {
  background: var(--ko);
}

@keyframes fill {
  from {
    transform: scaleX(0);
  }
}

.hint {
  font-size: 13px;
  color: var(--muted);
}

.limit {
  display: flex;
  align-items: center;
  gap: 12px;
}

.limit input {
  flex: 1;
  accent-color: var(--primary-solid);
}
</style>
