<script setup lang="ts">
/* Objectif course : compte à rebours, semaines restantes et temps prédit par la montre. */
import { Flag, ChevronRight, Plus } from 'lucide-vue-next'

defineProps<{ compact?: boolean }>()
const { goalInfo } = useFitness()
const label = (d: string) => GOAL_DISTANCES.find((x) => x.id === d)?.label ?? d
const dateFmt = new Intl.DateTimeFormat('fr-BE', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
</script>

<template>
  <NuxtLink v-if="goalInfo && !goalInfo.past" to="/objectif" class="card goal">
    <span class="count">
      <span class="num d">{{ goalInfo.days === 0 ? 'J' : `J-${goalInfo.days}` }}</span>
      <span class="eyebrow">{{ goalInfo.days === 0 ? 'c’est aujourd’hui' : goalInfo.weeks >= 2 ? `${goalInfo.weeks} semaines` : goalInfo.days === 1 ? 'demain' : 'cette semaine' }}</span>
    </span>
    <span class="row__main">
      <span class="eyebrow obj"><Flag :size="12" aria-hidden="true" /> Objectif · {{ label(goalInfo.distance) }}</span>
      <span class="title name">{{ goalInfo.name || `Mon ${label(goalInfo.distance).toLowerCase()}` }}</span>
      <span class="meta">
        {{ dateFmt.format(new Date(`${goalInfo.date}T12:00:00Z`)) }}<template v-if="goalInfo.predicted"> · prédit <strong class="num">{{ formatDuration(Math.round(goalInfo.predicted)) }}</strong></template>
      </span>
    </span>
    <ChevronRight class="go" :size="18" aria-hidden="true" />
  </NuxtLink>
  <NuxtLink v-else-if="!compact" to="/objectif" class="card add">
    <span class="tile" style="--tile: var(--accent-text)" aria-hidden="true"><Plus :size="22" /></span>
    <span class="row__main">
      <span class="title">Fixer un objectif course</span>
      <span class="meta">Compte à rebours et temps prédit sur Aujourd’hui</span>
    </span>
    <ChevronRight class="go" :size="18" aria-hidden="true" />
  </NuxtLink>
</template>

<style scoped>
.goal,
.add {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px;
}

.goal {
  overflow: hidden;
}

.goal::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: radial-gradient(60% 120% at 0% 50%, color-mix(in srgb, var(--primary-solid) 22%, transparent), transparent 70%);
  pointer-events: none;
}

.goal > * {
  position: relative;
  z-index: 1;
}

.count {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  min-width: 84px;
}

.d {
  font-size: 34px;
  background: var(--primary);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.obj {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--accent-text);
}

.name {
  font-size: 18px;
  white-space: normal;
  line-height: 1.2;
}

.meta {
  font-size: 13px;
  color: var(--muted);
}

.meta strong {
  color: var(--ink);
  font-size: 14px;
}

.go {
  flex-shrink: 0;
  color: var(--muted);
}
</style>
