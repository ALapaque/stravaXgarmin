/*
 * Débrief d'une course : issue de la séance, ressenti, note, titre et source choisis.
 * Logique pure, testée (tests/debrief.test.ts). L'état vit dans useDebriefs() côté navigateur.
 */
import type { Outcome, PlanComparison, StepResult } from './compliance'
import { isGenericName } from './naming'
import { cleanWatchName, parseTitle } from './titles'
import { stepDistance, stepDuration, type StepKind } from './workout'

export interface Debrief {
  status: 'draft' | 'done' | 'skipped'
  outcome: Outcome | null
  /** Effort ressenti, de 1 à 10 */
  rpe: number | null
  note: string
  source: string | null
  /** Séance du plan choisie à la main ; 'none' = séance libre ; null = laisser l'appli relier */
  planId: string | 'none' | null
  title: string | null
  block: string | null
  /** Étiquette d'échec : null = suivre l'issue (posée quand la séance est ratée) */
  fail?: boolean | null
  /** Dernière publication sur Strava (absente : gardé pour toi) */
  publishedAt?: string | null
  /** Dernière modification */
  at: string
}

export const emptyDebrief = (at: string): Debrief => ({
  status: 'draft',
  outcome: null,
  rpe: null,
  note: '',
  source: null,
  planId: null,
  title: null,
  block: null,
  at,
})

/** Fusionne une modification dans un débrief (créé s'il n'existe pas), datée de « at ». */
export function mergeDebrief(prev: Partial<Debrief> | null | undefined, patch: Partial<Debrief>, at: string): Debrief {
  return { ...emptyDebrief(at), ...(prev ?? {}), ...patch, at }
}

/**
 * Une course est « à débriefer » si elle n'a pas de débrief fait ou passé, qu'elle a commencé après « since »,
 * et que son titre Strava ne porte pas déjà une étiquette quand la convention est active
 * (titre déjà soigné à la main dans Strava = course déjà traitée). Sans « since », rien n'est réclamé.
 */
export function needsDebrief(
  run: { id: string; startedAt: string; stravaName?: string | null },
  debriefs: Record<string, Partial<Debrief> | undefined> | null | undefined,
  opts: { since: string | null | undefined; convention: boolean },
): boolean {
  const d = debriefs?.[run.id]
  if (d?.status === 'done' || d?.status === 'skipped') return false
  const since = opts.since ? Date.parse(opts.since) : Number.NaN
  const start = Date.parse(run.startedAt)
  if (!Number.isFinite(since) || !Number.isFinite(start) || start <= since) return false
  if (opts.convention && parseTitle(run.stravaName).tagged) return false
  return true
}

/* ───── Libellés ───── */

/** Mot de chaque note de ressenti, de 1 à 10. */
export const RPE_LABELS: Record<number, string> = {
  1: 'Très facile',
  2: 'Facile',
  3: 'Tranquille',
  4: 'Modéré',
  5: 'Soutenu',
  6: 'Un peu dur',
  7: 'Difficile',
  8: 'Très difficile',
  9: 'Extrême',
  10: 'Maximal',
}

/** Issue d'une séance, en un mot. */
export const OUTCOME_LABELS: Record<Outcome, string> = { done: 'Faite', short: 'Écourtée', failed: 'Ratée' }

/** Issue d'une séance dans le texte publié. */
const OUTCOME_LINE: Record<Outcome, string> = { done: 'Séance faite', short: 'Séance écourtée', failed: 'Séance ratée' }

/** Note de ressenti utilisable (entier de 1 à 10), sinon null. */
export const validRpe = (v: unknown): number | null => (typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 10 ? v : null)

/* ───── Texte publié dans la description Strava ───── */

/** Parties du texte du débrief, chacune activable dans les réglages (« description »). */
export interface DebriefParts {
  note: boolean
  feeling: boolean
  analysis: boolean
  numbers: boolean
  shoes: boolean
  signature: boolean
}

export const DEFAULT_PARTS: DebriefParts = { note: true, feeling: true, analysis: true, numbers: true, shoes: true, signature: true }

/** Lecture défensive d'un réglage gardé : les anciennes clés (enabled, weather, splits) sont ignorées. */
export function partsOf(v: unknown): DebriefParts {
  const o = v && typeof v === 'object' ? (v as Record<string, unknown>) : {}
  const out = { ...DEFAULT_PARTS }
  for (const k of Object.keys(DEFAULT_PARTS) as (keyof DebriefParts)[]) if (typeof o[k] === 'boolean') out[k] = o[k] as boolean
  return out
}

export interface BlockInput {
  note: string
  rpe: number | null
  outcome: Outcome | null
  resultSummary: string | null
  analysis: { verdict: string; findings: { title: string; text: string }[] } | null
  /** Durée (s) de chaque effort terminé, séances à répétitions */
  efforts: number[] | null
  /** Temps au km */
  splits: number[]
  shoe: { name: string; km: number } | null
  parts: DebriefParts
}

/** 141 → « 2:21 », 3725 → « 1:02:05 » */
function clock(sec: number) {
  const s = Math.round(sec)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`
}

/** Une ligne : blancs réduits, rien autour. */
const oneLine = (t: unknown) => String(t ?? '').replace(/\s+/g, ' ').trim()

/** Note du coureur : ses retours à la ligne gardés, sans espace en fin de ligne ni ligne vide en trop. */
function cleanNote(t: string) {
  return String(t ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.replace(/[ \t  ]+$/u, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

const positives = (list: unknown): number[] => (Array.isArray(list) ? list.filter((v): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0) : [])

/**
 * Texte du débrief ajouté sous la description Strava : la note, puis ressenti et issue, l'analyse,
 * les chiffres (efforts ou temps au km), les chaussures et la signature. Chaque partie seulement si
 * elle est activée et non vide ; '' s'il n'y a rien. Aucun espace en fin de ligne : ce texte doit être
 * retrouvé tel quel plus tard dans la description (locateBlock).
 */
export function composeBlock(i: BlockInput): string {
  const p = i.parts
  const note = p.note ? cleanNote(i.note) : ''
  const lines: string[] = []

  if (p.feeling) {
    const rpe = validRpe(i.rpe)
    const bits: string[] = []
    if (rpe) bits.push(`Ressenti : ${rpe}/10`)
    if (i.outcome && OUTCOME_LINE[i.outcome]) {
      const summary = oneLine(i.resultSummary)
      bits.push(`${OUTCOME_LINE[i.outcome]}${summary ? ` (${summary})` : ''}`)
    }
    if (bits.length) lines.push(bits.join(' · '))
  }

  if (p.analysis && i.analysis) {
    const verdict = oneLine(i.analysis.verdict)
    if (verdict) lines.push(verdict)
    for (const f of i.analysis.findings ?? []) {
      const title = oneLine(f?.title)
      const text = oneLine(f?.text)
      if (title && text) lines.push(`${title} : ${text}`)
      else if (title || text) lines.push(title || text)
    }
  }

  if (p.numbers) {
    const efforts = positives(i.efforts)
    const splits = positives(i.splits)
    if (efforts.length >= 2) lines.push(`Efforts : ${efforts.map(clock).join(' · ')}`)
    else if (splits.length) lines.push(`Km : ${splits.map(clock).join(' · ')}`)
  }

  if (p.shoes && i.shoe && oneLine(i.shoe.name)) {
    const km = Number.isFinite(i.shoe.km) ? Math.round(i.shoe.km) : null
    lines.push(`Chaussures : ${oneLine(i.shoe.name)}${km !== null ? ` (${km} km)` : ''}`)
  }

  if (p.signature && (note || lines.length)) lines.push('— via stravaXgarmin')

  if (!note) return lines.join('\n')
  return lines.length ? `${note}\n\n${lines.join('\n')}` : note
}

/* ───── Ce que la séance réalisée dit, étape par étape ───── */

const STEP_LABELS: Record<StepKind, string> = {
  warmup: 'Échauffement',
  cooldown: 'Retour au calme',
  interval: 'Effort',
  recovery: 'Récup',
  rest: 'Repos',
  other: 'Course',
}

export const stepLabel = (kind: StepKind) => STEP_LABELS[kind] ?? 'Étape'

/** « 400 m », « 15 min », « jusqu’au tour » */
export function plannedAmount(p: { sec: number | null; m: number | null }) {
  if (p.m) return stepDistance(p.m)
  if (p.sec) return stepDuration(p.sec)
  return 'jusqu’au tour'
}

/** Allure « 5:52 /km » d'un temps sur une distance (m) ; '' si la distance manque. */
export function paceText(sec: number, m: number) {
  if (!(m > 0) || !(sec > 0)) return ''
  return `${clock((sec / m) * 1000)} /km`
}

/**
 * Lignes lisibles des étapes, pour l'IA : « Effort 400 m : 2:21 à 5:52 /km, 163 bpm ».
 * Seules les étapes délimitées par des tours (« exact ») ont leurs chiffres ; les autres sont
 * des estimations : « fait », sans temps ni allure. 40 lignes au plus.
 */
export function stepLines(steps: StepResult[] | null | undefined, max = 40): string[] {
  const out: string[] = []
  for (const s of Array.isArray(steps) ? steps : []) {
    if (out.length >= max) break
    const head = `${stepLabel(s.kind)} ${plannedAmount(s.planned)}`
    if (s.done && s.exact && s.actual && s.actual.sec > 0) {
      const pace = paceText(s.actual.sec, s.actual.m)
      out.push(`${head} : ${clock(s.actual.sec)}${pace ? ` à ${pace}` : ''}${s.actual.hr ? `, ${s.actual.hr} bpm` : ''}`)
    } else if (s.done) out.push(`${head} : fait`)
    else if (s.fraction > 0) out.push(`${head} : arrêté en cours (${Math.round(s.fraction * 100)} %)`)
    else out.push(`${head} : non fait`)
  }
  return out
}

/**
 * Durée de chaque effort terminé d'une séance à répétitions, telle que la montre l'a mesurée
 * (seulement les efforts délimités par des tours). null si la séance n'est pas comptée en efforts
 * ou s'il y en a moins de 2.
 */
export function effortTimes(result: Pick<PlanComparison, 'basis' | 'steps'> | null | undefined): number[] | null {
  if (!result || result.basis !== 'reps') return null
  const list = (result.steps ?? []).filter((s) => s.kind === 'interval' && s.done && s.exact && s.actual && s.actual.sec > 0).map((s) => s.actual!.sec)
  return list.length >= 2 ? list : null
}

/* ───── Contexte de la séance pour l'analyse IA ───── */

export interface PlanContext {
  title: string
  summary: string
  outcome: Outcome | null
  result: string | null
  steps: string[]
}

export interface FeelingContext {
  rpe: number | null
  note?: string
}

/** Note transmise à l'IA : 500 caractères au plus. */
export const MAX_NOTE = 500

/**
 * Lignes ajoutées à la description d'une course pour l'IA : tapis, séance prévue, réalisé, étapes,
 * ressenti, et la note seulement si elle est transmise. Lecture défensive (vient du navigateur).
 */
export function describeContext(i: { indoor?: unknown; plan?: unknown; feeling?: unknown }): string[] {
  const lines: string[] = []
  if (i.indoor === true) lines.push('Séance sur tapis (pas de GPS : distance mesurée par la montre)')
  const plan = i.plan && typeof i.plan === 'object' ? (i.plan as Partial<PlanContext>) : null
  if (plan) {
    const title = oneLine(plan.title).slice(0, 100)
    const summary = oneLine(plan.summary).slice(0, 200)
    if (title || summary) lines.push(`Séance prévue : ${[title, summary].filter(Boolean).join(' — ')}`)
    const outcome = typeof plan.outcome === 'string' && plan.outcome in OUTCOME_LINE ? OUTCOME_LINE[plan.outcome as Outcome] : ''
    const result = oneLine(plan.result).slice(0, 100)
    if (outcome || result) lines.push(`Réalisé : ${[outcome, result].filter(Boolean).join(', ')}`)
    const steps = Array.isArray(plan.steps) ? plan.steps.slice(0, 40).map((s) => oneLine(s).slice(0, 120)).filter(Boolean) : []
    if (steps.length) lines.push(`Détail des étapes :\n${steps.map((s) => `- ${s}`).join('\n')}`)
  }
  const feeling = i.feeling && typeof i.feeling === 'object' ? (i.feeling as Partial<FeelingContext>) : null
  if (feeling) {
    const rpe = validRpe(feeling.rpe)
    if (rpe) lines.push(`Ressenti du coureur : ${rpe}/10`)
    const note = oneLine(feeling.note).slice(0, MAX_NOTE)
    if (note) lines.push(`Note du coureur : ${note}`)
  }
  return lines
}

/* ───── Titre proposé ───── */

/**
 * Titre (sans étiquettes) prérempli dans le débrief : le titre déjà soigné sur Strava ; sinon celui
 * de la séance prévue ; sinon le nom de la montre nettoyé ; sinon la règle de nommage.
 */
export function seedTitle(i: { stravaName?: string | null; planTitle?: string | null; garminName?: string | null; ruleTitle?: string | null }): string {
  const strava = parseTitle(i.stravaName).title
  if (strava && !isGenericName(strava)) return strava
  const plan = oneLine(i.planTitle)
  if (plan) return plan
  const watch = cleanWatchName(i.garminName).title
  if (watch && !isGenericName(watch)) return watch
  return oneLine(i.ruleTitle) || strava || 'Course'
}

/* ───── Profils « Prévu » et « Fait », sur le même axe de temps ───── */

/** Intensité relative de chaque nature d'étape (hauteur du profil prévu). */
export const STEP_LEVEL: Record<StepKind, number> = { warmup: 0.42, cooldown: 0.38, interval: 0.92, recovery: 0.28, rest: 0.18, other: 0.55 }
/** Vitesse supposée (m/s) pour placer une étape prévue en distance sur l'axe du temps */
const STEP_SPEED: Record<StepKind, number> = { warmup: 2.4, cooldown: 2.3, interval: 3.3, recovery: 2.1, rest: 2.1, other: 2.5 }

/** Durée prévue d'une étape (s) : son temps, sinon sa distance à une vitesse supposée, sinon ce qui a été couru (60 s à défaut). */
export const plannedSeconds = (s: Pick<StepResult, 'kind' | 'planned' | 'actual'>) =>
  s.planned.sec ?? (s.planned.m ? s.planned.m / (STEP_SPEED[s.kind] ?? 2.5) : (s.actual?.sec ?? 60))

export interface ProfileBar {
  kind: StepKind
  /** Durée (s) sur l'axe commun */
  sec: number
  /** Hauteur relative, de 0 à 1 */
  level: number
  /** done : faite ; partial : entamée ; missed : pas faite (dessinée en fantôme) */
  state: 'done' | 'partial' | 'missed'
}

/**
 * Deux profils alignés : « planned » (chaque étape prévue, à sa durée prévue ou estimée) et « done »
 * (la durée réellement courue, hauteur selon la vitesse ; la part non faite d'une étape en fantôme).
 * « total » : longueur commune de l'axe (le plus long des deux).
 */
export function planVsDone(steps: StepResult[] | null | undefined): { planned: ProfileBar[]; done: ProfileBar[]; total: number } {
  const list = Array.isArray(steps) ? steps : []
  const plannedSec = plannedSeconds
  const speeds = list.filter((s) => s.actual && s.actual.sec > 0 && s.actual.m > 0).map((s) => s.actual!.m / s.actual!.sec)
  const vMax = speeds.length ? Math.max(...speeds) : 0
  const vMin = speeds.length ? Math.min(...speeds) : 0
  const levelOf = (s: StepResult) => {
    const a = s.actual
    if (!a || !(a.sec > 0) || !(a.m > 0) || vMax <= vMin) return STEP_LEVEL[s.kind] ?? 0.5
    return 0.22 + 0.78 * ((a.m / a.sec - vMin) / (vMax - vMin))
  }
  const planned: ProfileBar[] = list.map((s) => ({ kind: s.kind, sec: plannedSec(s), level: STEP_LEVEL[s.kind] ?? 0.5, state: 'done' }))
  const done: ProfileBar[] = []
  for (const s of list) {
    const p = plannedSec(s)
    if (s.done) done.push({ kind: s.kind, sec: s.actual?.sec || p, level: levelOf(s), state: 'done' })
    else if (s.actual && s.actual.sec > 0) {
      done.push({ kind: s.kind, sec: s.actual.sec, level: levelOf(s), state: 'partial' })
      if (p > s.actual.sec) done.push({ kind: s.kind, sec: p - s.actual.sec, level: STEP_LEVEL[s.kind] ?? 0.5, state: 'missed' })
    } else done.push({ kind: s.kind, sec: p, level: STEP_LEVEL[s.kind] ?? 0.5, state: 'missed' })
  }
  const sum = (b: ProfileBar[]) => b.reduce((t, x) => t + x.sec, 0)
  return { planned, done, total: Math.max(sum(planned), sum(done), 1) }
}
