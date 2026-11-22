<script setup lang="ts">
/*
 * Prévu et Fait, deux profils alignés sur le même axe de temps : une barre par étape, largeur = durée.
 * Prévu (discret) : hauteur selon la nature de l'étape. Fait : la durée réellement courue, hauteur selon
 * la vitesse ; ce qui n'a pas été fait reste en fantôme hachuré (lisible sans légende ni couleur).
 * Sans comparaison possible (pas de tours), seul le profil prévu est dessiné.
 */
import type { StepResult } from '#shared/utils/compliance'
import type { PlanBlock } from '#shared/utils/model'

const props = withDefaults(defineProps<{ steps?: StepResult[] | null; blocks?: PlanBlock[] | null; height?: number }>(), { steps: null, blocks: null, height: 46 })

const COLORS: Record<string, string> = {
  warmup: 'var(--info)',
  cooldown: 'var(--info)',
  interval: 'var(--accent-text)',
  recovery: 'var(--ok)',
  rest: 'var(--muted)',
  other: 'var(--type-long)',
}

const data = computed(() => {
  if (props.steps?.length) return planVsDone(props.steps)
  const planned = (props.blocks ?? []).map((b) => ({ kind: b.kind, sec: Math.max(b.sec, 1), level: b.level, state: 'done' as const }))
  return { planned, done: [], total: Math.max(planned.reduce((t, b) => t + b.sec, 0), 1) }
})
const sum = (list: { sec: number }[]) => list.reduce((t, b) => t + b.sec, 0)
const doneSec = computed(() => sum(data.value.done.filter((b) => b.state !== 'missed')))
const plannedSec = computed(() => sum(data.value.planned))
const minutes = (s: number) => `${Math.round(s / 60)} min`
const efforts = computed(() => (props.steps ?? []).filter((s) => s.kind === 'interval'))
const label = computed(() => {
  const e = efforts.value
  const base = `Prévu : ${minutes(plannedSec.value)} environ`
  if (!data.value.done.length) return base
  const done = e.filter((s) => s.done).length
  return `${base}${e.length ? `, ${e.length} efforts` : ''}. Fait : ${minutes(doneSec.value)}${e.length ? `, ${done} efforts sur ${e.length}` : ''}.`
})
</script>

<template>
  <figure class="pvd" role="img" :aria-label="label">
    <div class="line">
      <span class="tag">Prévu</span>
      <div class="track" :style="{ height: `${height * 0.72}px` }">
        <span
          v-for="(b, i) in data.planned"
          :key="`p${i}`"
          class="bar plan"
          :style="{ flexGrow: b.sec / data.total, height: `${Math.round(Math.max(b.level, 0.14) * 100)}%`, '--c': COLORS[b.kind], '--i': i }"
        />
        <span v-if="plannedSec < data.total" class="rest" :style="{ flexGrow: (data.total - plannedSec) / data.total }" />
      </div>
      <span class="dur">{{ minutes(plannedSec) }}</span>
    </div>
    <div v-if="data.done.length" class="line">
      <span class="tag tag--done">Fait</span>
      <div class="track" :style="{ height: `${height}px` }">
        <span
          v-for="(b, i) in data.done"
          :key="`d${i}`"
          class="bar"
          :class="b.state"
          :style="{ flexGrow: b.sec / data.total, height: `${Math.round(Math.max(b.level, 0.14) * 100)}%`, '--c': COLORS[b.kind], '--i': i }"
        />
        <span v-if="sum(data.done) < data.total" class="rest" :style="{ flexGrow: (data.total - sum(data.done)) / data.total }" />
      </div>
      <span class="dur">{{ minutes(doneSec) }}</span>
    </div>
  </figure>
</template>

<style scoped>
.pvd {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
}

.line {
  display: grid;
  /* Première colonne : la place de « PRÉVU » dans toutes les polices (les deux lignes restent alignées) */
  grid-template-columns: 48px minmax(0, 1fr) auto;
  align-items: end;
  gap: 10px;
}

.tag {
  padding-bottom: 2px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
}

.tag--done {
  color: var(--ink);
}

.dur {
  padding-bottom: 1px;
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}

.track {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  border-bottom: 1px solid var(--line);
}

.bar {
  flex-basis: 0;
  min-width: 2px;
  border-radius: 3px 3px 0 0;
  background: linear-gradient(180deg, var(--c), color-mix(in srgb, var(--c) 40%, transparent));
  transform-origin: bottom;
  animation: grow 0.6s var(--ease-spring) backwards;
  animation-delay: calc(200ms + var(--i) * 22ms);
}

.rest {
  flex-basis: 0;
}

/* Prévu : discret */
.bar.plan {
  background: color-mix(in srgb, var(--c) 30%, transparent);
}

/* Entamée : même couleur, plus pâle */
.bar.partial {
  background: color-mix(in srgb, var(--c) 55%, transparent);
}

/* Pas faite : fantôme hachuré, sans couleur */
.bar.missed {
  background: repeating-linear-gradient(135deg, var(--line-strong) 0 1.5px, transparent 1.5px 5px);
  box-shadow: inset 0 0 0 1px var(--line);
  animation: none;
}
</style>
