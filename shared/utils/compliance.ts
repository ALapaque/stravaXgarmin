/*
 * Prévu contre réalisé : les étapes d'une séance du plan posées sur les tours de la montre.
 * Logique pure, testée (tests/compliance.test.ts).
 *
 * Comment une montre Garmin découpe une séance guidée : chaque fin d'étape crée un tour ; à l'intérieur
 * d'une étape longue, le tour automatique (1 km) en crée d'autres ; appuyer sur le bouton crée de petits
 * tours de quelques secondes ; l'arrêt laisse souvent un ou deux fragments à la fin. Les FRONTIÈRES de
 * tours sont donc fiables, mais les tours ne correspondent pas un pour un aux étapes : on parcourt les
 * étapes sur les frontières (temps et distance cumulés), jamais tour par tour.
 */
import { flattenSteps, parseWorkoutTitle, stepsDistance, stepsDuration, type FlatStep, type PlanStep, type StepKind } from './workout'

/** Un tour de la montre : distance en mètres, temps en mouvement et temps écoulé en secondes. */
export interface Lap {
  m: number
  sec: number
  elapsedSec: number
  hr: number | null
  maxHr: number | null
}

export interface StepResult {
  kind: StepKind
  planned: { sec: number | null; m: number | null }
  done: boolean
  /** Part réalisée, de 0 à 1 */
  fraction: number
  /** Ce qui a été parcouru pendant l'étape (FC moyenne pondérée par le temps) */
  actual: { sec: number; m: number; hr: number | null } | null
  /** L'étape commence ET finit sur une frontière de tour : ses chiffres sont ceux de la montre, pas une estimation */
  exact: boolean
  /** Début de l'étape (s, temps en mouvement cumulé depuis le départ de la course), quand elle a été courue */
  at?: number
}

/** Tolérances pour reconnaître la fin d'une étape sur une frontière de tour. */
export const TIME_TOLERANCE = (sec: number) => Math.max(6, sec * 0.025)
export const DIST_TOLERANCE = (m: number) => Math.max(12, m * 0.03)

interface Track {
  laps: Lap[]
  /** Temps et distance cumulés à chaque frontière (0 = départ, n = arrivée) */
  T: number[]
  D: number[]
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0)

function track(laps: Lap[]): Track {
  const clean = (Array.isArray(laps) ? laps : []).map((l) => ({
    m: num(l?.m),
    sec: num(l?.sec),
    elapsedSec: num(l?.elapsedSec),
    hr: num(l?.hr) || null,
    maxHr: num(l?.maxHr) || null,
  }))
  const T = [0]
  const D = [0]
  for (const l of clean) {
    T.push(T[T.length - 1]! + l.sec)
    D.push(D[D.length - 1]! + l.m)
  }
  return { laps: clean, T, D }
}

/** Point de la course à un temps cumulé donné, allure supposée régulière à l'intérieur du tour. */
function atTime(tr: Track, t: number) {
  const n = tr.laps.length
  for (let k = 0; k < n; k++) {
    if (t <= tr.T[k + 1]!) {
      const f = tr.laps[k]!.sec ? (t - tr.T[k]!) / tr.laps[k]!.sec : 0
      return { t, d: tr.D[k]! + f * tr.laps[k]!.m }
    }
  }
  return { t: tr.T[n]!, d: tr.D[n]! }
}

/** Point de la course à une distance cumulée donnée. */
function atDist(tr: Track, d: number) {
  const n = tr.laps.length
  for (let k = 0; k < n; k++) {
    if (d <= tr.D[k + 1]! && tr.laps[k]!.m) {
      const f = (d - tr.D[k]!) / tr.laps[k]!.m
      return { t: tr.T[k]! + f * tr.laps[k]!.sec, d }
    }
  }
  return { t: tr.T[n]!, d: tr.D[n]! }
}

/** FC moyenne entre deux temps cumulés, pondérée par le temps passé dans chaque tour. */
function hrBetween(tr: Track, t0: number, t1: number): number | null {
  let w = 0
  let s = 0
  tr.laps.forEach((l, k) => {
    if (!l.hr) return
    const overlap = Math.min(t1, tr.T[k + 1]!) - Math.max(t0, tr.T[k]!)
    if (overlap > 0) {
      w += overlap
      s += overlap * l.hr
    }
  })
  return w ? Math.round(s / w) : null
}

const EPS = 0.5

function segment(tr: Track, a: { t: number; d: number }, b: { t: number; d: number }) {
  return { sec: Math.round(b.t - a.t), m: Math.round(b.d - a.d), hr: hrBetween(tr, a.t, b.t) }
}

interface Walk {
  steps: StepResult[]
  exactEfforts: number
  doneEfforts: number
}

/** Parcourt toutes les étapes à partir de la frontière « start ». */
function walk(tr: Track, steps: FlatStep[], start: number): Walk {
  const n = tr.laps.length
  const end = { t: tr.T[n]!, d: tr.D[n]! }
  let p = { t: tr.T[start]!, d: tr.D[start]! }
  // Le point courant est-il une frontière de tour ? (vrai au départ, faux après une avancée « en continu »)
  let onLap = true
  let stopped = false
  const out: StepResult[] = []

  for (const s of steps) {
    const planned = { sec: s.sec, m: s.m }
    if (stopped) {
      out.push({ kind: s.kind, planned, done: false, fraction: 0, actual: null, exact: false })
      continue
    }
    const byDist = Boolean(s.m)
    const target = byDist ? s.m! : (s.sec ?? 0)

    // Étape « jusqu'au bouton tour » : elle finit à la frontière suivante
    if (!target) {
      const j = tr.T.findIndex((t, i) => i > 0 && t > p.t + EPS)
      if (j < 0) {
        stopped = true
        out.push({ kind: s.kind, planned, done: false, fraction: 0, actual: null, exact: false })
        continue
      }
      const q = { t: tr.T[j]!, d: tr.D[j]! }
      out.push({ kind: s.kind, planned, done: true, fraction: 1, actual: segment(tr, p, q), exact: onLap, at: Math.round(p.t) })
      p = q
      onLap = true
      continue
    }

    // 1. La frontière suivante la plus proche de la cible, dans la tolérance
    const tol = byDist ? DIST_TOLERANCE(target) : TIME_TOLERANCE(target)
    const from = byDist ? p.d : p.t
    const cum = byDist ? tr.D : tr.T
    let best = -1
    let bestDiff = Infinity
    for (let j = 1; j <= n; j++) {
      if (tr.T[j]! <= p.t + EPS) continue
      const got = cum[j]! - from
      if (got > target + tol) break
      const diff = Math.abs(got - target)
      if (diff <= tol && diff < bestDiff) {
        best = j
        bestDiff = diff
      }
    }
    if (best > 0) {
      const q = { t: tr.T[best]!, d: tr.D[best]! }
      out.push({ kind: s.kind, planned, done: true, fraction: 1, actual: segment(tr, p, q), exact: onLap, at: Math.round(p.t) })
      p = q
      onLap = true
      continue
    }

    // 2. Ce qui reste est trop court : la course s'est arrêtée pendant cette étape
    const left = (byDist ? end.d : end.t) - from
    if (left < target - tol) {
      stopped = true
      const some = end.t - p.t > EPS
      out.push({
        kind: s.kind,
        planned,
        done: false,
        fraction: Math.min(1, Math.max(0, left / target)),
        actual: some ? segment(tr, p, end) : null,
        exact: false,
        ...(some ? { at: Math.round(p.t) } : {}),
      })
      continue
    }

    // 3. La course continue mais aucune frontière ne tombe juste : on avance « en continu » de la cible
    const q = byDist ? atDist(tr, p.d + target) : atTime(tr, p.t + target)
    out.push({ kind: s.kind, planned, done: true, fraction: 1, actual: segment(tr, p, q), exact: false, at: Math.round(p.t) })
    p = q
    onLap = false
  }

  const efforts = out.filter((r) => r.kind === 'interval' && r.done)
  return { steps: out, doneEfforts: efforts.length, exactEfforts: efforts.filter((r) => r.exact).length }
}

/**
 * Pose les étapes prévues sur les tours. « aligned » : au moins une étape faite, et toutes les étapes
 * faites commencent et finissent sur des frontières de tours.
 *
 * Séance qui ne commence pas par un échauffement (souvent connue seulement par son titre, alors que le
 * coureur s'est échauffé avant) : chaque frontière est essayée comme départ, et on garde le parcours qui
 * termine le plus d'efforts EXACTEMENT sur des frontières (sinon, avancer « en continu » ferait gagner
 * n'importe quel départ), puis le plus d'efforts tout court, puis le départ le plus tôt.
 */
export function alignPlan(steps: FlatStep[], laps: Lap[]): { steps: StepResult[]; aligned: boolean } {
  const tr = track(laps)
  const flat = Array.isArray(steps) ? steps : []
  if (!tr.laps.length || !flat.length) {
    return {
      steps: flat.map((s) => ({ kind: s.kind, planned: { sec: s.sec, m: s.m }, done: false, fraction: 0, actual: null, exact: false })),
      aligned: false,
    }
  }
  let best = walk(tr, flat, 0)
  if (flat[0]!.kind !== 'warmup') {
    for (let start = 1; start < tr.laps.length; start++) {
      const w = walk(tr, flat, start)
      if (w.exactEfforts > best.exactEfforts || (w.exactEfforts === best.exactEfforts && w.doneEfforts > best.doneEfforts)) best = w
    }
  }
  const done = best.steps.filter((s) => s.done)
  return { steps: best.steps, aligned: done.length > 0 && done.every((s) => s.exact) }
}

/* ───── Issue d'une séance ───── */

export type Outcome = 'done' | 'short' | 'failed'

/** Au moins 90 % : faite ; au moins 50 % : écourtée ; sinon : ratée. */
export const OUTCOME_DONE = 0.9
export const OUTCOME_SHORT = 0.5

export const outcomeOf = (ratio: number): Outcome => (ratio >= OUTCOME_DONE ? 'done' : ratio >= OUTCOME_SHORT ? 'short' : 'failed')

export interface PlanComparison {
  ratio: number
  outcome: Outcome
  basis: 'reps' | 'duration' | 'distance'
  plannedReps?: number
  doneReps?: number
  steps: StepResult[]
  summary: string
}

/** « 40 min », « 1 h 20 » (minutes arrondies) */
function minutes(sec: number) {
  const m = Math.round(sec / 60)
  if (m < 60) return `${m} min`
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`
}

const km1 = (m: number) => (m / 1000).toLocaleString('fr-BE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const kmShort = (m: number) => (m / 1000).toLocaleString('fr-BE', { maximumFractionDigits: 1 })

/**
 * Compare une séance prévue à la course faite.
 * - Au moins 2 efforts, des tours, et une séance suivie sur la montre (au moins deux étapes et la moitié
 *   des efforts faits sont délimités par des tours) : efforts terminés / efforts prévus (un effort entamé
 *   ne compte pas).
 * - Séance à répétitions qu'on ne peut pas compter : durée totale du plan, à défaut sa distance, sinon null.
 * - Séance continue : la durée (celle du plan, à défaut la somme des étapes en temps), ou la distance si
 *   la séance est décrite en distance. Plafonné à 1.
 * - Rien de comparable → null (l'écran proposera « Faite » par défaut).
 */
export function comparePlan(
  plan: { steps?: PlanStep[] | null; durationSec?: number | null; distanceM?: number | null; title?: string | null },
  run: { durationSec: number; distanceM: number; laps?: Lap[] | null },
): PlanComparison | null {
  const own = Array.isArray(plan.steps) ? plan.steps : []
  const steps = own.length ? own : (parseWorkoutTitle(plan.title)?.steps ?? [])
  const flat = flattenSteps(steps)
  const laps = Array.isArray(run.laps) ? run.laps : []
  const aligned = laps.length && flat.length ? alignPlan(flat, laps).steps : []
  const plannedReps = flat.filter((s) => s.kind === 'interval').length

  /*
   * Séance suivie sur la montre : les étapes sont délimitées par des tours. Sans guidage, une étape peut
   * tomber par hasard sur une borne kilométrique ou sur la fin de la course : on demande donc au moins
   * deux étapes délimitées par des tours, et qu'au moins la moitié des efforts faits le soient.
   */
  const doneEfforts = aligned.filter((s) => s.kind === 'interval' && s.done)
  const exactSteps = aligned.filter((s) => s.done && s.exact).length
  const guided = doneEfforts.length > 0 && exactSteps >= 2 && doneEfforts.filter((s) => s.exact).length * 2 >= doneEfforts.length
  if (plannedReps >= 2 && laps.length && guided) {
    const doneReps = aligned.filter((s) => s.kind === 'interval' && s.done).length
    const ratio = Math.min(1, doneReps / plannedReps)
    return {
      ratio,
      outcome: outcomeOf(ratio),
      basis: 'reps',
      plannedReps,
      doneReps,
      steps: aligned,
      summary: `${doneReps} ${doneReps > 1 ? 'efforts' : 'effort'} sur ${plannedReps}`,
    }
  }

  /*
   * Durée ou distance :
   * - étapes toutes en distance → distance ; toutes en temps → durée (celle du plan, à défaut la somme) ;
   * - sinon (étapes mêlées ou absentes) : la durée du plan, à défaut sa distance.
   */
  const stepSec = stepsDuration(flat)
  const stepM = stepsDistance(flat)
  const planSec = num(plan.durationSec) || null
  const planM = num(plan.distanceM) || null
  const doneSec = num(run.durationSec)
  const doneM = num(run.distanceM)
  let byDistance: boolean
  let target: number | null
  /*
   * Séance à répétitions dont on ne peut pas compter les efforts (pas de tours, ou séance faite sans
   * guidage : aucun effort ne tombe sur une frontière de tour) : seul un total prévu par le plan
   * (durée, à défaut distance) reste comparable. La somme des étapes d'un simple titre
   * (« 5x400m(R=200m) », sans son échauffement) ne dit rien : on ne compare pas.
   */
  if (plannedReps >= 2) [byDistance, target] = planSec ? [false, planSec] : [true, planM]
  else if (stepM && !stepSec) [byDistance, target] = [true, stepM]
  else if (stepSec && !stepM) [byDistance, target] = [false, planSec ?? stepSec]
  else if (planSec) [byDistance, target] = [false, planSec]
  else [byDistance, target] = [true, planM]
  if (!target) return null

  if (byDistance) {
    const ratio = Math.min(1, doneM / target)
    return { ratio, outcome: outcomeOf(ratio), basis: 'distance', steps: aligned, summary: `${km1(doneM)} km sur ${kmShort(target)}` }
  }
  const ratio = Math.min(1, doneSec / target)
  const summary = doneSec < 3600 && target < 3600 ? `${Math.round(doneSec / 60)} min sur ${Math.round(target / 60)}` : `${minutes(doneSec)} sur ${minutes(target)}`
  return { ratio, outcome: outcomeOf(ratio), basis: 'duration', steps: aligned, summary }
}
