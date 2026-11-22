/*
 * Règles de l'écran « Aujourd'hui » : la carte principale (et les cartes qui la suivent), la semaine
 * en cours jour par jour, et les alertes. Logique pure, testée (tests/today.test.ts).
 * Les dates sont des jours AAAA-MM-JJ (heure de Bruxelles), comparables comme des textes.
 */

import { shiftDay } from './planstate'

const DAY = 86_400_000

/** Lundi de la semaine d'un jour (semaines du lundi au dimanche). */
export function mondayOf(day: string) {
  const d = new Date(`${day}T12:00:00Z`)
  return new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * DAY).toISOString().slice(0, 10)
}

/** Écart en jours entre deux jours (b − a). */
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / DAY)

export interface DayRun {
  id: string
  localDate: string
  type: string
  distanceKm: number
  durationSec: number
}

export interface DaySession {
  id: string
  date: string
}

/* ───── Carte principale ───── */

export type Focus =
  | { kind: 'debrief'; runId: string; more: number }
  | { kind: 'today'; sessionId: string }
  | { kind: 'next'; sessionId: string }
  | { kind: 'last'; runId: string }
  | { kind: 'empty' }

/**
 * Carte principale d'Aujourd'hui, dans cet ordre :
 * 1. une course à débriefer (la plus récente ; « more » = les autres en attente) ;
 * 2. sinon une séance prévue aujourd'hui et pas encore faite ;
 * 3. sinon la prochaine séance (après aujourd'hui, pas encore faite) ;
 * 4. sinon la dernière course ; sans aucune course, « empty ».
 * Puis, en cartes normales, ce qui n'a pas été choisi : la séance (du jour, sinon la prochaine), puis la
 * dernière course (sauf si c'est déjà celle de la carte principale).
 *
 * - toDebrief : courses à débriefer, la plus récente d'abord ;
 * - sessions : séances du plan (dans n'importe quel ordre) ; done : identifiants des séances déjà faites ;
 * - lastRun : la course la plus récente.
 */
export function pickFocus(i: {
  toDebrief: string[]
  sessions: DaySession[]
  done: string[]
  lastRun: string | null
  today: string
}): { main: Focus; secondary: Focus[] } {
  const done = new Set(i.done)
  const open = i.sessions.filter((s) => !done.has(s.id) && s.date >= i.today).sort((a, b) => a.date.localeCompare(b.date))
  const todays = open.find((s) => s.date === i.today)
  const next = open.find((s) => s.date > i.today)
  const plan: Focus | null = todays ? { kind: 'today', sessionId: todays.id } : next ? { kind: 'next', sessionId: next.id } : null
  const last: Focus | null = i.lastRun ? { kind: 'last', runId: i.lastRun } : null

  if (i.toDebrief.length) {
    const runId = i.toDebrief[0]!
    const secondary: Focus[] = []
    if (plan) secondary.push(plan)
    if (last && runId !== i.lastRun) secondary.push(last)
    return { main: { kind: 'debrief', runId, more: i.toDebrief.length - 1 }, secondary }
  }
  if (plan) return { main: plan, secondary: last ? [last] : [] }
  if (last) return { main: last, secondary: [] }
  return { main: { kind: 'empty' }, secondary: [] }
}

/* ───── Ta semaine ───── */

export type DayState = 'done' | 'planned' | 'skipped' | 'rest'

export interface WeekDay {
  date: string
  state: DayState
  /** Courses du jour, la plus longue d'abord (sa couleur est celle du jour) */
  runs: DayRun[]
  km: number
  /** Séances prévues ce jour-là */
  sessions: string[]
  isToday: boolean
  isFuture: boolean
}

export interface WeekView {
  from: string
  to: string
  days: WeekDay[]
  km: number
  sec: number
  runs: number
  /** Séances prévues sur la semaine entière (à venir comprises) et séances faites */
  planned: number
  doneSessions: number
  /** Kilomètres de la semaine passée, aux mêmes jours (du lundi au jour de la semaine d'aujourd'hui) */
  previousKm: number
  deltaKm: number
  /** Vrai le dimanche : la comparaison porte sur deux semaines entières */
  fullWeek: boolean
}

/**
 * La semaine en cours, du lundi au dimanche. État de chaque jour :
 * - « done » : au moins une course ce jour-là ;
 * - « skipped » : une séance prévue un jour passé, pas faite, et aucune course ;
 * - « planned » : une séance prévue aujourd'hui ou plus tard, pas encore faite ;
 * - « rest » : rien.
 */
export function weekView(i: { today: string; runs: DayRun[]; sessions: DaySession[]; done: string[] }): WeekView {
  const from = mondayOf(i.today)
  const to = shiftDay(from, 6)
  const done = new Set(i.done)
  const inWeek = (d: string) => d >= from && d <= to
  const runs = i.runs.filter((r) => inWeek(r.localDate))
  const sessions = i.sessions.filter((s) => inWeek(s.date))

  const days: WeekDay[] = Array.from({ length: 7 }, (_, k) => {
    const date = shiftDay(from, k)
    const dayRuns = runs.filter((r) => r.localDate === date).sort((a, b) => b.distanceKm - a.distanceKm)
    const daySessions = sessions.filter((s) => s.date === date)
    const open = daySessions.filter((s) => !done.has(s.id))
    const state: DayState = dayRuns.length
      ? 'done'
      : open.length
        ? date < i.today ? 'skipped' : 'planned'
        : 'rest'
    return {
      date,
      state,
      runs: dayRuns,
      km: dayRuns.reduce((t, r) => t + r.distanceKm, 0),
      sessions: daySessions.map((s) => s.id),
      isToday: date === i.today,
      isFuture: date > i.today,
    }
  })

  const km = runs.reduce((t, r) => t + r.distanceKm, 0)
  const span = daysBetween(from, i.today)
  const prevFrom = shiftDay(from, -7)
  const prevTo = shiftDay(prevFrom, span)
  const previousKm = i.runs.filter((r) => r.localDate >= prevFrom && r.localDate <= prevTo).reduce((t, r) => t + r.distanceKm, 0)

  return {
    from,
    to,
    days,
    km,
    sec: runs.reduce((t, r) => t + r.durationSec, 0),
    runs: runs.length,
    planned: sessions.length,
    doneSessions: sessions.filter((s) => done.has(s.id)).length,
    previousKm,
    deltaKm: km - previousKm,
    fullWeek: span === 6,
  }
}

/* ───── Alertes ───── */

export interface Alert {
  kind: 'health' | 'load' | 'shoes' | 'goal'
  text: string
  to: string
}

/**
 * Alertes d'Aujourd'hui, seulement quand il y a quelque chose à dire :
 * lecture principale en échec, charge en forte hausse, chaussures bientôt usées, objectif dans moins de 15 jours.
 */
export function todayAlerts(i: {
  core?: string | null
  ramp?: { pct: number; high: boolean } | null
  shoes?: { name: string; km: number; soon: boolean }[]
  goal?: { name?: string; days: number; past?: boolean; label: string } | null
}): Alert[] {
  const out: Alert[] = []
  if (i.core === 'strava.activities') out.push({ kind: 'health', text: 'Strava n’a pas répondu', to: '/reglages/etat' })
  else if (i.core === 'garmin.activities') out.push({ kind: 'health', text: 'Garmin n’a pas répondu', to: '/reglages/etat' })
  if (i.ramp?.high) out.push({ kind: 'load', text: `Charge +${i.ramp.pct} % cette semaine`, to: '/progression' })
  for (const s of i.shoes ?? []) {
    if (s.soon) out.push({ kind: 'shoes', text: `${s.name} à ${Math.round(s.km)} km`, to: '/progression?onglet=materiel' })
  }
  const g = i.goal
  if (g && !g.past && g.days >= 0 && g.days < 15) {
    const name = g.name?.trim() || g.label
    out.push({ kind: 'goal', text: g.days === 0 ? `Jour J · ${name}` : `J-${g.days} · ${name}`, to: '/objectif' })
  }
  return out
}
