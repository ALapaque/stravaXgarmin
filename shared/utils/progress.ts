/*
 * Progression : plan suivi sur plusieurs semaines, série en cours, courses par semaine (sans plan) et
 * liste des compétitions. Logique pure, testée (tests/progress.test.ts).
 */
import type { AdherenceWeek } from './planmatch'
import { formatPace } from './format'
import { displayTitle } from './titles'
import { mondayOf } from './today'

const DAY = 86_400_000
const shift = (day: string, n: number) => new Date(Date.parse(`${day}T12:00:00Z`) + n * DAY).toISOString().slice(0, 10)

export interface PlanFollowed {
  planned: number
  done: number
  short: number
  failed: number
  skipped: number
  /** Séances faites en entier sur séances prévues, en % arrondi ; null sans aucune séance prévue */
  pct: number | null
  /** Séances courues (faites, écourtées ou ratées) sur séances prévues, en % ; null sans séance prévue */
  ranPct: number | null
}

/**
 * Plan suivi sur les semaines données (celles de `adherence`). « Faites » : seules les séances faites
 * en entier comptent dans le pourcentage principal ; écourtées et ratées sont comptées à part.
 */
export function planFollowed(weeks: AdherenceWeek[]): PlanFollowed {
  const t = { planned: 0, done: 0, short: 0, failed: 0, skipped: 0 }
  for (const w of weeks) {
    t.planned += w.planned
    t.done += w.done
    t.short += w.short
    t.failed += w.failed
    t.skipped += w.skipped
  }
  const pct = (n: number) => (t.planned ? Math.round((n / t.planned) * 100) : null)
  return { ...t, pct: pct(t.done), ranPct: pct(t.done + t.short + t.failed) }
}

/** Un plan est connu dès qu'une séance était prévue sur la période. */
export const hasPlan = (weeks: AdherenceWeek[]) => weeks.some((w) => w.planned > 0)

export interface Streak {
  /** Nombre de semaines de suite */
  weeks: number
  /** La série remonte jusqu'à la plus ancienne semaine connue : elle est peut-être plus longue */
  open: boolean
  /** La semaine en cours compte déjà dans la série */
  current: boolean
}

/**
 * Série en cours, de la semaine la plus récente vers la plus ancienne (semaines données de la plus
 * ancienne à la plus récente, la dernière étant la semaine en cours).
 * - La semaine en cours compte si elle remplit déjà la condition ; sinon elle ne casse pas la série
 *   (elle n'est pas finie).
 * - Une semaine passée qui ne remplit pas la condition arrête la série.
 */
export function streak<T>(weeks: T[], ok: (w: T) => boolean): Streak {
  if (!weeks.length) return { weeks: 0, open: false, current: false }
  const last = weeks.length - 1
  const current = ok(weeks[last]!)
  let n = current ? 1 : 0
  let i = last - 1
  for (; i >= 0; i--) {
    if (!ok(weeks[i]!)) break
    n++
  }
  return { weeks: n, open: i < 0 && n > 0, current }
}

/** Semaine sans séance sautée : il fallait au moins une séance prévue, et aucune ne l'a été. */
export const planWeekOk = (w: AdherenceWeek) => w.planned > 0 && w.skipped === 0

/** Sans plan : au moins 2 courses dans la semaine. */
export const RUNS_PER_WEEK = 2
export const runsWeekOk = (w: { runs: number }) => w.runs >= RUNS_PER_WEEK

export interface RunsWeek {
  /** Lundi de la semaine */
  from: string
  runs: number
  km: number
  current: boolean
}

/** Courses et kilomètres par semaine (lundi → dimanche), la plus ancienne d'abord, jusqu'à la semaine de « today ». */
export function runsPerWeek(runs: { localDate: string; distanceKm: number }[], today: string, weeks = 8): RunsWeek[] {
  const monday = mondayOf(today)
  return Array.from({ length: weeks }, (_, i) => {
    const from = shift(monday, -(weeks - 1 - i) * 7)
    const to = shift(from, 6)
    const inside = runs.filter((r) => r.localDate >= from && r.localDate <= to)
    return { from, runs: inside.length, km: inside.reduce((s, r) => s + (r.distanceKm || 0), 0), current: i === weeks - 1 }
  })
}

export interface RaceRun {
  id: string
  type: string
  startedAt: string
  localDate: string
  distanceKm: number
  durationSec: number
  stravaName?: string | null
  garminName?: string | null
}

export interface RaceItem {
  id: string
  date: string
  title: string
  distanceKm: number
  durationSec: number
  /** « 5:36 » (par km) */
  pace: string
}

/** Compétitions (courses de type « race »), la plus récente d'abord, avec le titre affiché dans l'appli. */
export function raceList(runs: RaceRun[]): RaceItem[] {
  return runs
    .filter((r) => r.type === 'race')
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .map((r) => ({
      id: r.id,
      date: r.localDate,
      title: displayTitle(r).title,
      distanceKm: r.distanceKm,
      durationSec: r.durationSec,
      pace: r.distanceKm > 0 ? formatPace(r.durationSec, r.distanceKm) : '–',
    }))
}
