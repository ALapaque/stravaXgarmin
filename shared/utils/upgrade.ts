/*
 * Mise à niveau de l'état gardé dans le navigateur par une version précédente de l'appli.
 * Il est rechargé AVANT la première synchro et n'a pas les nouveaux champs : rien ne doit planter
 * ni s'afficher faux pendant ces premières secondes. On complète, on ne remet jamais à zéro.
 * Logique pure, testée (tests/upgrade.test.ts).
 */
import type { Lap } from './compliance'
import { brusselsDay } from './format'
import type { Activity, RunSport } from './model'
import { RUN_LABELS, type RunType } from './runs'

const isObj = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === 'object' && !Array.isArray(v)
const str = (v: unknown, d = '') => (typeof v === 'string' ? v : d)
const numOr = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d)
const optNum = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : undefined)
const SPORTS: RunSport[] = ['Run', 'TrailRun', 'VirtualRun']

function lapOf(v: unknown): Lap | null {
  if (!isObj(v)) return null
  const sec = numOr(v.sec, 0)
  return { m: numOr(v.m, 0), sec, elapsedSec: numOr(v.elapsedSec, sec), hr: optNum(v.hr) ?? null, maxHr: optNum(v.maxHr) ?? null }
}

/** Une course gardée, complétée avec des valeurs par défaut pour chaque champ absent ou abîmé. */
export function upgradeActivity(raw: unknown): Activity {
  const a = isObj(raw) ? raw : {}
  const startedAt = str(a.startedAt)
  const durationSec = numOr(a.durationSec, 0)
  const type = (typeof a.type === 'string' && a.type in RUN_LABELS ? a.type : 'easy') as RunType
  const indoor = a.indoor === true
  const out: Activity = {
    ...(a as Partial<Activity>),
    id: str(a.id, `x-${startedAt}`),
    type,
    startedAt,
    localDate: /^\d{4}-\d{2}-\d{2}$/.test(str(a.localDate)) ? str(a.localDate) : brusselsDay(startedAt),
    indoor,
    sport: SPORTS.includes(a.sport as RunSport) ? (a.sport as RunSport) : 'Run',
    place: indoor ? 'tapis' : str(a.place),
    distanceKm: numOr(a.distanceKm, 0),
    durationSec,
    elapsedSec: numOr(a.elapsedSec, durationSec),
    avgHr: numOr(a.avgHr, 0),
    elevationM: numOr(a.elevationM, 0),
    splits: Array.isArray(a.splits) ? a.splits.filter((s): s is number => typeof s === 'number') : [],
    bestEfforts: isObj(a.bestEfforts) ? (a.bestEfforts as Activity['bestEfforts']) : {},
    garminName: str(a.garminName, str(a.stravaName)),
    stravaName: str(a.stravaName, str(a.garminName)),
  }
  if (a.laps !== undefined) out.laps = Array.isArray(a.laps) ? a.laps.map(lapOf).filter((l): l is Lap => l !== null) : []
  if (a.maxHr !== undefined) out.maxHr = optNum(a.maxHr)
  return out
}

/** Liste de courses gardée : toujours un tableau de courses complètes. */
export const upgradeActivities = (raw: unknown): Activity[] => (Array.isArray(raw) ? raw.filter(isObj).map(upgradeActivity) : [])
