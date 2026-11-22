<script setup lang="ts">
/*
 * Prévu ↔ réalisé d'une course reliée à une séance : en tête le résultat (« 5 efforts sur 8 ») et l'issue ;
 * puis chaque étape, prévu → fait. Les répétitions sont regroupées (« 8 × 400 m, récup 1 min ») avec une
 * pastille par effort (son temps, « fait », entamé ou pas fait en hachures) et le détail à déplier.
 * Une étape dont les chiffres ne viennent pas des tours de la montre (exact faux) n'affiche que « fait ».
 * Regroupement : shared/utils/runchart.ts (groupSteps, stepDone).
 */
import { Check, ChevronDown, CircleCheckBig, CircleDotDashed, CircleX } from 'lucide-vue-next'
import type { Outcome, PlanComparison, StepResult } from '#shared/utils/compliance'
import type { PlanSession } from '#shared/utils/model'
import type { PlanStep } from '#shared/utils/workout'

const props = defineProps<{ session: PlanSession; steps: PlanStep[]; result: PlanComparison | null; outcome: Outcome | null }>()

const KIND_COLORS: Record<string, string> = {
  warmup: 'var(--info)',
  cooldown: 'var(--info)',
  interval: 'var(--accent-text)',
  recovery: 'var(--ok)',
  rest: 'var(--muted)',
  other: 'var(--type-long)',
}
const ICONS = { done: CircleCheckBig, short: CircleDotDashed, failed: CircleX }
const TONES = { done: 'var(--ok)', short: 'var(--accent-text)', failed: 'var(--ko)' }

const results = computed(() => props.result?.steps ?? [])
const rows = computed(() => groupSteps(props.steps, results.value))
/** Sans regroupement possible : les étapes à plat */
const flat = computed(() => {
  let effort = 0
  let rec = 0
  return results.value.map((r) => ({
    label: r.kind === 'interval' ? `Effort ${++effort}` : r.kind === 'recovery' ? `Récup ${++rec}` : stepLabel(r.kind),
    planned: plannedAmount(r.planned),
    result: r,
  }))
})
const open = ref<Record<number, boolean>>({})
const state = (r: StepResult) => (r.done ? 'done' : r.fraction > 0 ? 'partial' : 'missed')
const effortText = (r: StepResult) => (r.done && r.exact && r.actual ? clock(r.actual.sec) : '')
const effortLabel = (label: string, r: StepResult) => `${label} : ${stepDone(r)}`

const reps = computed(() => (props.result?.basis === 'reps' ? { done: props.result.doneReps ?? 0, of: props.result.plannedReps ?? 0 } : null))
</script>

<template>
  <section class="card card--pad pd" aria-labelledby="pd-title">
    <div class="section-head">
      <h2 id="pd-title" class="eyebrow">Prévu <span aria-hidden="true">↔</span><span class="sr-only">et</span> réalisé</h2>
      <span v-if="session.provider" class="provider">{{ session.provider }}</span>
    </div>

    <div class="pd-head">
      <div class="pd-plan">
        <p class="h2">{{ session.title }}</p>
        <p v-if="steps.length" class="label">{{ stepsSummary(steps) }}</p>
      </div>
      <div class="pd-result">
        <p v-if="reps" class="big"><span class="num">{{ reps.done }}</span> <span class="of">effort{{ reps.done > 1 ? 's' : '' }} sur {{ reps.of }}</span></p>
        <p v-else-if="result" class="big big--text">{{ result.summary }}</p>
        <span v-if="outcome" class="outcome" :style="{ '--tone': TONES[outcome] }">
          <component :is="ICONS[outcome]" :size="16" aria-hidden="true" />{{ OUTCOME_LABELS[outcome] }}
        </span>
      </div>
    </div>

    <p v-if="!results.length" class="fine">Pas de tours sur cette course : impossible de comparer étape par étape.</p>

    <ol v-else-if="rows" class="steps">
      <li v-for="(row, i) in rows" :key="i" class="st" :class="row.type === 'step' ? state(row.result) : 'repeat'">
        <template v-if="row.type === 'step'">
          <span class="mk" :style="{ '--c': KIND_COLORS[row.result.kind] }" aria-hidden="true" />
          <span class="st-main">
            <span class="st-name">{{ row.label }} <span class="st-plan">· {{ row.planned }}</span></span>
            <span class="st-done"><span class="arrow" aria-hidden="true">→</span> {{ stepDone(row.result) }}</span>
          </span>
        </template>
        <template v-else>
          <span class="mk mk--rep" :style="{ '--c': KIND_COLORS.interval }" aria-hidden="true" />
          <span class="st-main">
            <span class="st-name">{{ row.label }}</span>
            <span class="pills" role="list" :aria-label="`${row.efforts.filter((e) => e.result.done).length} efforts faits sur ${row.efforts.length}`">
              <span
                v-for="(e, k) in row.efforts"
                :key="k"
                class="pill"
                :class="state(e.result)"
                role="listitem"
                :aria-label="effortLabel(e.label, e.result)"
                :style="{ '--k': k }"
              >
                <span class="pill-n" aria-hidden="true">{{ k + 1 }}</span>
                <span class="pill-v" aria-hidden="true">
                  <template v-if="effortText(e.result)">{{ effortText(e.result) }}</template>
                  <Check v-else-if="e.result.done" :size="14" />
                  <template v-else-if="e.result.fraction > 0">entamé</template>
                  <template v-else>—</template>
                </span>
              </span>
            </span>
            <button type="button" class="link more" :aria-expanded="Boolean(open[i])" @click="open = { ...open, [i]: !open[i] }">
              {{ open[i] ? 'Masquer le détail' : `Voir le détail (${row.items.length} étapes)` }}
              <ChevronDown :size="16" class="chev" aria-hidden="true" />
            </button>
            <ol v-if="open[i]" class="sub">
              <li v-for="(it, k) in row.items" :key="k" class="st st--sub" :class="state(it.result)">
                <span class="mk" :style="{ '--c': KIND_COLORS[it.result.kind] }" aria-hidden="true" />
                <span class="st-main st-main--row">
                  <span class="st-name">{{ it.label }} <span class="st-plan">· {{ it.planned }}</span></span>
                  <span class="st-done">{{ stepDone(it.result) }}</span>
                </span>
              </li>
            </ol>
          </span>
        </template>
      </li>
    </ol>

    <ol v-else class="steps">
      <li v-for="(it, k) in flat" :key="k" class="st" :class="state(it.result)">
        <span class="mk" :style="{ '--c': KIND_COLORS[it.result.kind] }" aria-hidden="true" />
        <span class="st-main">
          <span class="st-name">{{ it.label }} <span class="st-plan">· {{ it.planned }}</span></span>
          <span class="st-done"><span class="arrow" aria-hidden="true">→</span> {{ stepDone(it.result) }}</span>
        </span>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.pd {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.pd .section-head {
  margin-top: 0;
}

.provider {
  padding: 3px 8px;
  border-radius: var(--r-pill);
  background: var(--surface-2);
  font-size: 11px;
  font-weight: 700;
  color: var(--ink-2);
}

.pd-head {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.pd-plan {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.pd-result {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 12px;
  padding: 12px 14px;
  border-radius: var(--r-ctrl);
  background: var(--surface-2);
}

.big {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin: 0;
}

.big .num {
  font-size: 40px;
}

.of {
  font-weight: 700;
  color: var(--ink-2);
}

.big--text {
  font-family: var(--font-display);
  font-weight: var(--title-weight);
  font-size: 20px;
}

.outcome {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: var(--r-pill);
  font-size: 13px;
  font-weight: 700;
  color: var(--tone);
  background: color-mix(in srgb, var(--tone) 14%, transparent);
}

.steps,
.sub {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
}

.st {
  display: flex;
  gap: 12px;
  padding: 12px 0;
  border-top: 1px solid var(--line);
}

.st:first-child {
  border-top: 0;
  padding-top: 0;
}

.st:last-child {
  padding-bottom: 0;
}

.mk {
  flex-shrink: 0;
  width: 4px;
  align-self: stretch;
  min-height: 34px;
  border-radius: var(--r-pill);
  background: var(--c);
}

.st-main {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  flex: 1;
}

.st-name {
  font-weight: 700;
}

.st-plan {
  font-weight: 500;
  color: var(--muted);
}

.st-done {
  font-family: var(--font-mono);
  font-size: 13px;
  color: var(--ink-2);
  font-variant-numeric: tabular-nums;
}

.arrow {
  color: var(--muted);
}

/* Pas faite : grisée, repère hachuré */
.st.missed .st-name,
.st.missed .st-done {
  color: var(--muted);
}

.st.missed > .mk {
  background: repeating-linear-gradient(180deg, var(--line-strong) 0 3px, transparent 3px 6px);
}

.st.partial > .mk {
  background: repeating-linear-gradient(180deg, var(--c) 0 3px, transparent 3px 6px);
}

/* ── Pastilles d'efforts ── */
.pills {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(58px, 1fr));
  gap: 6px;
  margin-top: 6px;
}

.pill {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 46px;
  padding: 0 8px;
  border-radius: var(--r-ctrl);
  border: 1px solid color-mix(in srgb, var(--accent-text) 45%, transparent);
  background: color-mix(in srgb, var(--accent-text) 14%, transparent);
  animation: pop 0.45s var(--ease-spring) backwards;
  animation-delay: calc(250ms + var(--k) * 40ms);
}

.pill-n {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  color: var(--muted);
}

.pill-v {
  display: inline-flex;
  align-items: center;
  font-family: var(--font-mono);
  font-size: 14px;
  font-weight: 700;
  color: var(--ink);
  font-variant-numeric: tabular-nums;
}

.pill-v svg {
  color: var(--accent-text);
}

.pill.partial {
  border-style: dashed;
  background: repeating-linear-gradient(135deg, color-mix(in srgb, var(--accent-text) 18%, transparent) 0 3px, transparent 3px 7px);
}

.pill.partial .pill-v {
  font-size: 11px;
  color: var(--ink-2);
}

.pill.missed {
  border: 1px dashed var(--line-strong);
  background: repeating-linear-gradient(135deg, var(--line) 0 1.5px, transparent 1.5px 6px);
}

.pill.missed .pill-v {
  color: var(--muted);
}

.more {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  align-self: flex-start;
  min-height: 44px;
  font-size: 14px;
}

.more[aria-expanded='true'] .chev {
  transform: rotate(180deg);
}

.sub {
  margin-top: 2px;
  animation: rise 0.35s var(--ease-out);
}

.st--sub {
  padding: 8px 0;
}

.st--sub:first-child {
  border-top: 1px solid var(--line);
  padding-top: 8px;
}

.st--sub .mk {
  min-height: 20px;
  width: 3px;
}

.st-main--row {
  gap: 2px;
}

.st--sub .st-name {
  font-weight: 600;
  font-size: 14px;
}
</style>
