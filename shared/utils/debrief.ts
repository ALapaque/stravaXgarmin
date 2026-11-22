/*
 * Débrief d'une course : issue de la séance, ressenti, note, titre et source choisis.
 * Logique pure, testée (tests/debrief.test.ts). L'état vit dans useDebriefs() côté navigateur.
 */
import type { Outcome } from './compliance'
import { parseTitle } from './titles'

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
