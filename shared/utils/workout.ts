/*
 * Étapes d'une séance prévue : structure lue chez Garmin, ou devinée depuis le titre
 * (« 5x400m(R=200m) », « Footing 40’ », « SL 1h30 »…). Logique pure, testée (tests/workout.test.ts).
 */
import type { RunType } from './runs'

export type StepKind = 'warmup' | 'cooldown' | 'interval' | 'recovery' | 'rest' | 'other'

export interface PlanStep {
  kind: StepKind | 'repeat'
  /** Durée prévue en secondes (étape en temps) */
  sec: number | null
  /** Distance prévue en mètres (étape en distance) */
  m: number | null
  /** Répétition : nombre de passages et étapes répétées */
  reps?: number
  children?: PlanStep[]
  /** Cible lisible (« 4:05–4:15 /km », « zone 2 cardio »), seulement pour l'affichage */
  target?: string | null
}

/** Étape dépliée ; sec et m tous deux null = « jusqu'au bouton tour ». */
export interface FlatStep {
  kind: StepKind
  sec: number | null
  m: number | null
}

/** Répétitions dépliées (imbriquées comprises), « max » étapes au plus. */
export function flattenSteps(steps: PlanStep[] | null | undefined, max = 200): FlatStep[] {
  const out: FlatStep[] = []
  const walk = (list: PlanStep[]) => {
    for (const s of list) {
      if (out.length >= max) return
      if (s.kind === 'repeat') {
        const reps = Math.max(0, Math.floor(s.reps ?? 1))
        for (let i = 0; i < reps && out.length < max; i++) walk(s.children ?? [])
        continue
      }
      out.push({ kind: s.kind, sec: positive(s.sec), m: positive(s.m) })
    }
  }
  walk(Array.isArray(steps) ? steps : [])
  return out
}

const positive = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null)

/** Somme des durées des étapes en temps (null s'il n'y en a aucune). */
export function stepsDuration(steps: FlatStep[]): number | null {
  const timed = steps.filter((s) => s.sec)
  return timed.length ? timed.reduce((t, s) => t + s.sec!, 0) : null
}

/** Somme des distances des étapes en distance (null s'il n'y en a aucune). */
export function stepsDistance(steps: FlatStep[]): number | null {
  const d = steps.filter((s) => s.m)
  return d.length ? d.reduce((t, s) => t + s.m!, 0) : null
}

/* ───── Résumé lisible ───── */

/** 2400 → « 40 min », 75 → « 1 min 15 s », 30 → « 30 s », 4800 → « 1 h 20 » */
export function stepDuration(sec: number): string {
  const s = Math.round(sec)
  if (s < 60) return `${s} s`
  if (s >= 3600) {
    const h = Math.floor(s / 3600)
    const m = Math.round((s % 3600) / 60)
    return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`
  }
  const m = Math.floor(s / 60)
  return s % 60 ? `${m} min ${s % 60} s` : `${m} min`
}

/** 400 → « 400 m », 1000 → « 1 km », 1500 → « 1,5 km » */
export function stepDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`
  return `${(m / 1000).toLocaleString('fr-BE', { maximumFractionDigits: 2 })} km`
}

function stepText(s: { sec: number | null; m: number | null }) {
  if (s.m) return stepDistance(s.m)
  if (s.sec) return stepDuration(s.sec)
  return 'jusqu’au tour'
}

/** « 5 × 400 m, récup 200 m » · « 40 min » · « 20 min + 6 × 3 min, récup 2 min + 10 min » */
export function stepsSummary(steps: PlanStep[] | null | undefined): string {
  return (steps ?? [])
    .map((s) => {
      if (s.kind !== 'repeat') return stepText(s)
      const children = s.children ?? []
      const effort = children.find((c) => c.kind === 'interval') ?? children.find((c) => c.kind !== 'recovery' && c.kind !== 'rest') ?? children[0]
      const rest = children.find((c) => c !== effort && (c.kind === 'recovery' || c.kind === 'rest'))
      if (!effort) return ''
      const inner = effort.kind === 'repeat' ? stepsSummary([effort]) : stepText(effort)
      return `${s.reps ?? 1} × ${inner}${rest && rest.kind !== 'repeat' ? `, récup ${stepText(rest)}` : ''}`
    })
    .filter(Boolean)
    .join(' + ')
}

/* ───── Titre d'un plan → étapes ───── */

type Amount = { sec: number | null; m: number | null }

/*
 * Une quantité écrite dans un titre : « 400m », « 1,5km », « 3' », « 3'30 », « 1’15 », « 30" », « 45 s »,
 * « 8 min ». Sans unité : ≥ 100 → mètres, ≤ 20 → minutes, entre les deux → secondes.
 */
const AMOUNT = String.raw`(\d+(?:[.,]\d+)?)\s*(km|m(?![a-z])|min|mn|'\s*\d{1,2}(?!\d)|'|"|s(?![a-z]))?`

function amount(value: string, unit: string | undefined): Amount {
  const v = Number(value.replace(',', '.'))
  const u = (unit ?? '').replace(/\s+/g, '')
  if (u === 'km') return { sec: null, m: Math.round(v * 1000) }
  if (u === 'm') return { sec: null, m: Math.round(v) }
  if (u === 'min' || u === 'mn' || u === "'") return { sec: Math.round(v * 60), m: null }
  if (u.startsWith("'")) return { sec: Math.round(v * 60 + Number(u.slice(1))), m: null }
  if (u === '"' || u === 's') return { sec: Math.round(v), m: null }
  if (v >= 100) return { sec: null, m: Math.round(v) }
  if (v <= 20) return { sec: Math.round(v * 60), m: null }
  return { sec: Math.round(v), m: null }
}

/** Minuscules, apostrophes et « × » unifiés, « '' » (secondes) écrit « " ». */
function normalize(title: string) {
  return title
    .toLowerCase()
    .replace(/[’‘′`´]/g, "'")
    .replace(/''|″|“|”/g, '"')
    .replace(/[×*]/g, 'x')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Indice donné par les mots du titre. */
function hintOf(t: string): RunType | null {
  if (/sortie longue|long run|\bsl\b/.test(t)) return 'long'
  if (/tempo|seuil|threshold/.test(t)) return 'tempo'
  if (/r[ée]cup|recovery/.test(t)) return 'recovery'
  if (/vma|fraction|interval|piste|\d+\s*x\s*\d/.test(t)) return 'interval'
  if (/footing|easy|\bef\b|\bef\d|endurance|\bz2\b|jogging/.test(t)) return 'easy'
  return null
}

/** Première durée « continue » du titre : « 1h20 », « 1 h », « 40’ », « 40 min », « EF45 ». */
function firstDuration(t: string): number | null {
  const re = /(\d{1,2})\s*h\s*(\d{1,2})?(?!\d)|(\d{1,3})\s*(?:'|min\b|mn\b)|\bef\s*(\d{2,3})\b|\bsl\s*(\d{2,3})\b/g
  const m = re.exec(t)
  if (!m) return null
  if (m[1]) return Number(m[1]) * 3600 + Number(m[2] ?? 0) * 60
  return Number(m[3] ?? m[4] ?? m[5]) * 60
}

/**
 * Étapes devinées depuis le titre d'une séance de plan, et le type qu'il laisse deviner.
 * Rien de reconnu → null ; un type reconnu sans durée (« Test VMA ») → steps: [].
 */
export function parseWorkoutTitle(title: string | null | undefined): { steps: PlanStep[]; hint: RunType | null } | null {
  const t = normalize(String(title ?? ''))
  if (!t) return null
  const hint = hintOf(t)

  // Répétitions : « 5x400m », « 6 x 800 m », « 10x30"/30" », « 4x4 »
  const rep = t.match(new RegExp(String.raw`(?:^|[^\d.,])(\d{1,2})\s*x\s*${AMOUNT}(?:\s*/\s*${AMOUNT})?`))
  if (rep) {
    const reps = Number(rep[1])
    const effort = amount(rep[2]!, rep[3])
    let rest: Amount | null = null
    if (rep[4]) {
      // « 30/30 » : la récup a la même unité que l'effort quand elle n'en a pas
      if (rep[5]) rest = amount(rep[4], rep[5])
      else if (effort.m) rest = { sec: null, m: Math.round(Number(rep[4].replace(',', '.'))) }
      else {
        // Effort en minutes (« 3'/2 ») ou en secondes (« 30/30 ») : la récup suit
        const perUnit = effort.sec! / Number(rep[2]!.replace(',', '.')) >= 60 ? 60 : 1
        rest = { sec: Math.round(Number(rep[4].replace(',', '.')) * perUnit), m: null }
      }
    } else {
      // « (R=200m) », « R=2' », « r1'15 », « récup 2' » : le « r » ne doit pas finir un mot (« HR »)
      const r = t.slice((rep.index ?? 0) + rep[0].length).match(new RegExp(String.raw`(?:^|[\s(,;/+-])r(?:[ée]cup[a-z]*)?\s*[=:]?\s*${AMOUNT}`))
      if (r) rest = amount(r[1]!, r[2])
    }
    if (reps > 0 && (effort.sec || effort.m)) {
      const children: PlanStep[] = [{ kind: 'interval', ...effort }]
      if (rest && (rest.sec || rest.m)) children.push({ kind: 'recovery', ...rest })
      return { steps: [{ kind: 'repeat', sec: null, m: null, reps, children }], hint: hint === 'tempo' ? 'tempo' : 'interval' }
    }
  }

  // Une seule durée : la première du titre (« Footing 50’ - 3’ rapide » → 50 min)
  const sec = firstDuration(t)
  if (sec) {
    const kind = hint === 'tempo' ? 'interval' : 'other'
    return { steps: [{ kind, sec, m: null }], hint: hint ?? 'easy' }
  }
  // Une distance : « Footing 8 km »
  const km = t.match(/(\d+(?:[.,]\d)?)\s*km\b/)
  if (km && hint !== 'interval') {
    return { steps: [{ kind: 'other', sec: null, m: Math.round(Number(km[1]!.replace(',', '.')) * 1000) }], hint: hint ?? 'easy' }
  }
  return hint ? { steps: [], hint } : null
}
