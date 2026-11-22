/*
 * Ligne de temps du Journal : courses et séances sautées, regroupées par semaine (lundi → dimanche),
 * de la plus récente à la plus ancienne. Logique pure, testée (tests/journal.test.ts).
 */
import { shiftDay } from './planstate'
import { daysBetween, mondayOf } from './today'

export interface JournalRun {
  id: string
  localDate: string
  /** Instant de départ (ISO) : ordre de deux courses le même jour */
  startedAt: string
  distanceKm: number
}

export interface JournalSession {
  id: string
  date: string
  title: string
}

export type JournalItem =
  | { kind: 'run'; id: string; date: string }
  | { kind: 'skipped'; id: string; date: string; title: string }

export interface JournalWeek {
  /** Lundi et dimanche (AAAA-MM-JJ) */
  from: string
  to: string
  /** « Cette semaine », « La semaine dernière », « Semaine du 9 novembre » */
  label: string
  current: boolean
  km: number
  runs: number
  /** Séances prévues sur la semaine (à venir comprises) et séances faites */
  planned: number
  done: number
  /** Du plus récent au plus ancien ; le même jour, les courses avant la séance sautée */
  items: JournalItem[]
}

const monthDay = new Intl.DateTimeFormat('fr-BE', { day: 'numeric', month: 'long', timeZone: 'UTC' })
const yearFmt = new Intl.DateTimeFormat('fr-BE', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })

/** Titre d'une semaine par rapport à aujourd'hui (l'année seulement si elle diffère). */
export function weekLabel(from: string, today: string) {
  const weeks = Math.round(daysBetween(from, mondayOf(today)) / 7)
  if (weeks === 0) return 'Cette semaine'
  if (weeks === 1) return 'La semaine dernière'
  const d = new Date(`${from}T12:00:00Z`)
  return `Semaine du ${(from.slice(0, 4) === today.slice(0, 4) ? monthDay : yearFmt).format(d)}`
}

/**
 * Semaines du journal, de la semaine d'aujourd'hui jusqu'à la plus ancienne course ou séance passée.
 * Les semaines vides entre deux sont gardées (items vides) : la ligne de temps reste honnête.
 * Séance sautée : prévue avant aujourd'hui et pas faite (« done » : séances reliées à une course).
 */
export function journalWeeks(i: { today: string; runs: JournalRun[]; sessions: JournalSession[]; done: string[] }): JournalWeek[] {
  const done = new Set(i.done)
  const skipped = i.sessions.filter((s) => s.date < i.today && !done.has(s.id))
  const dates = [...i.runs.map((r) => r.localDate), ...skipped.map((s) => s.date)].filter((d) => d && d <= i.today)
  if (!dates.length) return []
  const oldest = mondayOf(dates.reduce((a, b) => (a < b ? a : b)))
  const out: JournalWeek[] = []
  for (let from = mondayOf(i.today); from >= oldest; from = shiftDay(from, -7)) {
    const to = shiftDay(from, 6)
    const inWeek = (d: string) => d >= from && d <= to
    const runs = i.runs.filter((r) => inWeek(r.localDate) && r.localDate <= i.today)
    const sessions = i.sessions.filter((s) => inWeek(s.date))
    const items: (JournalItem & { order: string })[] = [
      ...runs.map((r) => ({ kind: 'run' as const, id: r.id, date: r.localDate, order: `${r.localDate}|1|${r.startedAt}` })),
      ...skipped.filter((s) => inWeek(s.date)).map((s) => ({ kind: 'skipped' as const, id: s.id, date: s.date, title: s.title, order: `${s.date}|0|` })),
    ]
    items.sort((a, b) => b.order.localeCompare(a.order))
    out.push({
      from,
      to,
      label: weekLabel(from, i.today),
      current: inWeek(i.today),
      km: runs.reduce((t, r) => t + r.distanceKm, 0),
      runs: runs.length,
      planned: sessions.length,
      done: sessions.filter((s) => done.has(s.id)).length,
      items: items.map(({ order: _, ...rest }) => rest as JournalItem),
    })
  }
  return out
}
