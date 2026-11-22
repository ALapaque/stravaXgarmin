/*
 * Lecture d'une séance du calendrier Garmin (API non officielle) : déroulé lisible (« lines »),
 * profil (« blocks ») et étapes structurées (« steps »), construits dans le même parcours.
 * Lecture défensive : une étape illisible est ignorée, jamais d'erreur. Testée (tests/garminWorkout.test.ts).
 */
import type { PlanBlock, PlanKind, PlanLine } from './model'
import type { PlanStep } from './workout'

/** Étape telle que Garmin la décrit (champs utiles seulement, tous facultatifs). */
export interface GarminStep {
  type?: string
  stepType?: { stepTypeKey?: string } | null
  description?: string | null
  endCondition?: { conditionTypeKey?: string } | null
  endConditionValue?: number | null
  targetType?: { workoutTargetTypeKey?: string } | null
  targetValueOne?: number | null
  targetValueTwo?: number | null
  zoneNumber?: number | null
  numberOfIterations?: number | null
  workoutSteps?: GarminStep[] | null
}

const KINDS: Record<string, PlanKind> = { warmup: 'warmup', cooldown: 'cooldown', interval: 'interval', recovery: 'recovery', rest: 'rest' }
const LABEL: Record<PlanKind, string> = {
  warmup: 'Échauffement',
  cooldown: 'Retour au calme',
  interval: 'Effort',
  recovery: 'Récup',
  rest: 'Repos',
  other: 'Course',
}
const BASE_LEVEL: Record<PlanKind, number> = { warmup: 0.42, cooldown: 0.38, interval: 0.9, recovery: 0.28, rest: 0.18, other: 0.6 }

const pace = (ms: number) => {
  const s = Math.round(1000 / ms)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
const dur = (s: number) => (s >= 60 ? `${Math.round(s / 60)} min${s % 60 && s < 600 ? ` ${s % 60} s` : ''}` : `${s} s`)
const dist = (m: number) => (m >= 1000 ? `${(m / 1000).toLocaleString('fr-BE', { maximumFractionDigits: 2 })} km` : `${Math.round(m)} m`)
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

function target(s: GarminStep) {
  const t = s.targetType?.workoutTargetTypeKey
  const a = num(s.targetValueOne)
  const b = num(s.targetValueTwo)
  if (t === 'pace.zone' && a > 0 && b > 0) return { text: `${pace(Math.max(a, b))}–${pace(Math.min(a, b))} /km`, ms: (a + b) / 2 }
  if (t === 'heart.rate.zone') {
    if (a && b) return { text: `${Math.round(Math.min(a, b))}–${Math.round(Math.max(a, b))} bpm` }
    if (s.zoneNumber) return { text: `zone ${s.zoneNumber} cardio` }
  }
  return undefined
}

const kindOf = (s: GarminStep): PlanKind => KINDS[s.stepType?.stepTypeKey ?? ''] ?? 'other'

export interface WalkedWorkout {
  lines: PlanLine[]
  blocks: PlanBlock[]
  steps: PlanStep[]
}

/** Parcourt les étapes Garmin (répétitions imbriquées comprises). */
export function walkGarminSteps(raw: unknown): WalkedWorkout {
  const blocks: PlanBlock[] = []
  const { lines, steps } = walk(Array.isArray(raw) ? raw : [], blocks, 0)
  return { lines, blocks: blocks.slice(0, 80), steps }
}

function walk(list: unknown[], blocks: PlanBlock[], depth: number): { lines: PlanLine[]; steps: PlanStep[] } {
  const lines: PlanLine[] = []
  const steps: PlanStep[] = []
  for (const item of list) {
    if (!item || typeof item !== 'object') continue
    const s = item as GarminStep
    const iterations = num(s.numberOfIterations)
    if (Array.isArray(s.workoutSteps) && s.workoutSteps.length && iterations > 0 && depth < 4) {
      const reps = Math.floor(iterations)
      const inner: PlanBlock[] = []
      const children = walk(s.workoutSteps, inner, depth + 1)
      for (let i = 0; i < Math.min(reps, 30); i++) blocks.push(...inner)
      lines.push({ kind: 'repeat', reps, text: `${reps} ×`, children: children.lines })
      steps.push({ kind: 'repeat', sec: null, m: null, reps, children: children.steps })
      continue
    }
    const kind = kindOf(s)
    const cond = s.endCondition?.conditionTypeKey
    const v = num(s.endConditionValue)
    const tg = target(s)
    const parts: string[] = []
    let sec = 0
    const step: PlanStep = { kind, sec: null, m: null, target: tg?.text ?? null }
    if (cond === 'time' && v > 0) {
      parts.push(dur(v))
      sec = v
      step.sec = Math.round(v)
    } else if (cond === 'distance' && v > 0) {
      parts.push(dist(v))
      sec = v / (tg?.ms ?? 2.8)
      step.m = Math.round(v)
    } else {
      // Fin au bouton tour (ou condition inconnue) : ni temps ni distance
      parts.push(cond === 'lap.button' ? 'jusqu’au tour' : '')
      sec = kind === 'interval' ? 180 : 300
    }
    if (tg) parts.push(`à ${tg.text}`)
    // Une allure cible rapide pousse la barre plus haut
    const level = tg?.ms ? Math.min(1, Math.max(0.2, (tg.ms - 2) / 3)) : BASE_LEVEL[kind]
    blocks.push({ kind, sec: Math.round(sec), level })
    const text = [LABEL[kind], parts.filter(Boolean).join(' ')].filter(Boolean).join(' · ')
    lines.push({ kind, text: s.description ? `${text} — ${String(s.description).slice(0, 80)}` : text })
    steps.push(step)
  }
  return { lines, steps }
}
