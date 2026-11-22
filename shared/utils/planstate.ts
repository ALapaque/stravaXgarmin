/*
 * Plan gardé dans le navigateur : séances passées et à venir, fusionnées à chaque lecture du calendrier.
 * Les séances passées ne changent plus : le serveur ne relit que celles que le navigateur n'a pas encore.
 * Logique pure, testée (tests/planstate.test.ts).
 */
import type { PlanSession } from './model'

/** Séances passées lues chez Garmin (jours en arrière) */
export const PLAN_PAST_DAYS = 35
/** Séances passées gardées dans le navigateur (jours en arrière) */
export const PLAN_KEEP_DAYS = 60

/** Séance passée déjà connue du navigateur, renvoyée en forme réduite par le serveur. */
export interface KnownSession {
  id: string
  date: string
  title: string
  workoutId: number | null
  known: true
}

const isObj = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === 'object' && !Array.isArray(v)
const str = (v: unknown, d = '') => (typeof v === 'string' ? v : d)
const numOrNull = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null)

export function shiftDay(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** Une séance gardée (ou reçue), complétée : jamais de champ absent. */
export function upgradePlanSession(raw: unknown): PlanSession {
  const s = isObj(raw) ? raw : {}
  return {
    ...(s as Partial<PlanSession>),
    id: str(s.id, `${str(s.date)}|${str(s.title)}`),
    date: str(s.date),
    title: str(s.title, 'Séance'),
    description: typeof s.description === 'string' ? s.description : null,
    provider: typeof s.provider === 'string' ? s.provider : null,
    durationSec: numOrNull(s.durationSec),
    distanceM: numOrNull(s.distanceM),
    lines: Array.isArray(s.lines) ? (s.lines as PlanSession['lines']) : [],
    blocks: Array.isArray(s.blocks) ? (s.blocks as PlanSession['blocks']) : [],
    workoutId: numOrNull(s.workoutId),
    steps: Array.isArray(s.steps) ? (s.steps as PlanSession['steps']) : [],
  }
}

/**
 * Plan gardé par une version précédente : séances complétées (steps: [], workoutId: null).
 * S'il manquait des étapes, la date de lecture est effacée : la prochaine lecture du plan
 * ne s'arrête pas au délai de fraîcheur et va chercher les étapes tout de suite.
 */
export function upgradePlanState(raw: unknown): { at: string; list: PlanSession[] } | null {
  if (!isObj(raw)) return null
  const list = Array.isArray(raw.list) ? raw.list.filter(isObj) : []
  const old = list.some((s) => !Array.isArray(s.steps))
  return { at: old ? '' : str(raw.at), list: list.map(upgradePlanSession) }
}

/** Identifiants des séances passées que le serveur n'a pas besoin de relire. */
export function knownIds(list: PlanSession[], today: string): string[] {
  return list.filter((s) => s.date < today && !s.pending && !s.synthetic && Array.isArray(s.steps)).map((s) => s.id)
}

/**
 * Fusion d'une lecture du calendrier avec ce qui est gardé :
 * - une séance connue (forme réduite) garde son détail, avec la date et le titre du calendrier ;
 * - une séance de la fenêtre lue (35 jours en arrière, et tout le futur) absente du calendrier est retirée ;
 * - plus ancienne que la fenêtre : gardée jusqu'à 60 jours ;
 * - un doublon (même id, ou même jour et même titre) n'est gardé qu'une fois. Tri par date.
 */
export function mergePlan(stored: PlanSession[], fresh: unknown[], today: string): PlanSession[] {
  const byId = new Map(stored.map((s) => [s.id, s]))
  const windowStart = shiftDay(today, -PLAN_PAST_DAYS)
  const keepFrom = shiftDay(today, -PLAN_KEEP_DAYS)
  const out: PlanSession[] = []
  for (const item of Array.isArray(fresh) ? fresh : []) {
    if (!isObj(item)) continue
    if (item.known === true) {
      const old = byId.get(str(item.id))
      const stub = upgradePlanSession(item)
      // Connue d'après le navigateur, mais plus là (autre appareil, état effacé) : relue la prochaine fois
      out.push(old ? { ...old, date: stub.date || old.date, title: stub.title || old.title, workoutId: stub.workoutId ?? old.workoutId } : { ...stub, pending: true })
      continue
    }
    out.push(upgradePlanSession(item))
  }
  const seen = new Set(out.map((s) => s.id))
  for (const s of stored) {
    if (seen.has(s.id) || s.synthetic) continue
    if (s.date < windowStart && s.date >= keepFrom) out.push(s)
  }
  const unique = out.filter((s, i) => s.date >= keepFrom && out.findIndex((o) => o.id === s.id || (o.date === s.date && o.title === s.title)) === i)
  return unique.sort((a, b) => a.date.localeCompare(b.date))
}
