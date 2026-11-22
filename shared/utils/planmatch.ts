/*
 * Relier les courses faites aux séances prévues du plan, et suivre le plan semaine par semaine.
 * Logique pure, testée (tests/planmatch.test.ts).
 */
import type { Outcome } from './compliance'
import { normalizeTitle } from './titles'

export interface MatchRun {
  id: string
  /** Jour de la course (AAAA-MM-JJ, heure locale) */
  localDate: string
  /** Noms connus de la course : Strava, montre… */
  names: string[]
  workoutId?: number | null
}

export interface MatchSession {
  id: string
  date: string
  title: string
  workoutId?: number | null
}

const DAY = 86_400_000
const dayDiff = (a: string, b: string) => Math.round((Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / DAY)

/** Titres comparés sans espaces (« 5 x 400 m » = « 5x400m ») ; trop court pour être parlant → ''. */
const key = (s: string) => {
  const k = normalizeTitle(s).replace(/\s+/g, '')
  return k.length >= 4 ? k : ''
}

function titleMatch(session: string, names: string[]) {
  const s = key(session)
  if (!s) return false
  return names.some((n) => {
    const k = key(n)
    return Boolean(k) && (k.includes(s) || s.includes(k))
  })
}

/** Jour du jour à Bruxelles, quand l'appelant ne le donne pas. */
const brusselsToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Brussels' }).format(new Date())

/**
 * Séance reliée à chaque course.
 * - Un choix manuel gagne toujours ('none' = séance libre, la course n'est reliée à rien).
 * - Sinon : séances à un jour d'écart au plus, pas encore prises. Score : même workoutId +5 ; titre de la
 *   séance contenu dans un nom de la course ou l'inverse +4 ; même jour +3. Au moins 3 points, et un titre
 *   qui correspond si le jour diffère. Les meilleures paires sont servies d'abord ; une séance ne va qu'à une course.
 * - « skipped » : séances d'avant « today » sans course (celle du jour n'est jamais « sautée »).
 */
export function matchPlan(
  runs: MatchRun[],
  sessions: MatchSession[],
  manual: Record<string, string | 'none'> = {},
  today: string = brusselsToday(),
): { byRun: Record<string, string>; skipped: string[] } {
  const byRun: Record<string, string> = {}
  const taken = new Set<string>()
  const ids = new Set(sessions.map((s) => s.id))
  const free: MatchRun[] = []

  for (const r of runs) {
    const m = manual[r.id]
    if (m === 'none') continue
    if (m && ids.has(m) && !taken.has(m)) {
      byRun[r.id] = m
      taken.add(m)
    } else free.push(r)
  }

  const pairs: { run: string; session: string; score: number; gap: number; order: number }[] = []
  free.forEach((r, order) => {
    for (const s of sessions) {
      if (taken.has(s.id) || !r.localDate || !s.date) continue
      const gap = Math.abs(dayDiff(r.localDate, s.date))
      if (gap > 1) continue
      const title = titleMatch(s.title, r.names ?? [])
      if (gap > 0 && !title) continue
      const score = (r.workoutId && s.workoutId && r.workoutId === s.workoutId ? 5 : 0) + (title ? 4 : 0) + (gap === 0 ? 3 : 0)
      if (score >= 3) pairs.push({ run: r.id, session: s.id, score, gap, order })
    }
  })
  pairs.sort((a, b) => b.score - a.score || a.gap - b.gap || a.order - b.order)
  for (const p of pairs) {
    if (byRun[p.run] || taken.has(p.session)) continue
    byRun[p.run] = p.session
    taken.add(p.session)
  }

  const skipped = sessions.filter((s) => s.date < today && !taken.has(s.id)).map((s) => s.id)
  return { byRun, skipped }
}

export interface AdherenceWeek {
  /** Lundi de la semaine (AAAA-MM-JJ) */
  from: string
  planned: number
  done: number
  short: number
  failed: number
  skipped: number
}

/**
 * Suivi du plan par semaine (lundi → dimanche), la plus ancienne d'abord, jusqu'à la semaine de « today ».
 * Une séance compte dès qu'elle est passée, ou le jour même si une course y est reliée.
 * Course reliée sans issue connue (« outcomes ») : comptée comme faite.
 */
export function adherence(
  sessions: MatchSession[],
  byRun: Record<string, string>,
  outcomes: Record<string, Outcome | null | undefined>,
  today: string,
  weeks = 8,
): AdherenceWeek[] {
  const runOf = new Map(Object.entries(byRun).map(([run, session]) => [session, run]))
  const t = new Date(`${today}T12:00:00Z`)
  const monday = new Date(t.getTime() - ((t.getUTCDay() + 6) % 7) * DAY)
  return Array.from({ length: weeks }, (_, i) => {
    const start = new Date(monday.getTime() - (weeks - 1 - i) * 7 * DAY)
    const from = start.toISOString().slice(0, 10)
    const to = new Date(start.getTime() + 6 * DAY).toISOString().slice(0, 10)
    const w: AdherenceWeek = { from, planned: 0, done: 0, short: 0, failed: 0, skipped: 0 }
    for (const s of sessions) {
      if (s.date < from || s.date > to || s.date > today) continue
      const run = runOf.get(s.id)
      if (!run && s.date === today) continue
      w.planned++
      if (!run) w.skipped++
      else w[outcomes[run] ?? 'done']++
    }
    return w
  })
}
