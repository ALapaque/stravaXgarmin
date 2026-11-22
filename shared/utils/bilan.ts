/*
 * Bilan de la semaine : semaine montrée par défaut, plan suivi de la semaine, et ce qui part chez l'IA
 * (les chiffres, le plan suivi, les ressentis sur 10 des débriefs ; jamais les notes écrites).
 * Logique pure, testée (tests/bilan.test.ts). Sert au navigateur (page /bilan) et au serveur (/api/ai/week).
 */
import type { Outcome } from './compliance'
import { mondayOf } from './today'

const DAY = 86_400_000
const shift = (day: string, n: number) => new Date(Date.parse(`${day}T12:00:00Z`) + n * DAY).toISOString().slice(0, 10)
const isDay = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T12:00:00Z`))

/** Nombre de semaines passées que le bilan permet de revoir (en plus de la semaine en cours). */
export const BILAN_WEEKS_BACK = 7

/**
 * Semaine montrée par défaut : la semaine en cours, sauf le lundi ou tant qu'aucune course n'y figure
 * (la semaine qui vient de finir est alors plus parlante).
 */
export function defaultBilanWeek(today: string, runDays: string[]): string {
  const monday = mondayOf(today)
  const any = runDays.some((d) => d >= monday && d <= today)
  return today === monday || !any ? shift(monday, -7) : monday
}

/**
 * Lundi demandé dans l'adresse (?semaine=AAAA-MM-JJ), ramené au lundi et borné aux semaines revues ;
 * null s'il est absent ou illisible.
 */
export function pickBilanWeek(asked: unknown, today: string): string | null {
  if (!isDay(asked)) return null
  const current = mondayOf(today)
  const oldest = shift(current, -7 * BILAN_WEEKS_BACK)
  const m = mondayOf(asked)
  if (m > current) return current
  if (m < oldest) return oldest
  return m
}

export type WeekSessionStatus = Outcome | 'skipped' | 'today' | 'upcoming'

export interface WeekSession {
  id: string
  date: string
  title: string
  status: WeekSessionStatus
  /** Course reliée à la séance */
  runId: string | null
}

export interface WeekPlan {
  sessions: WeekSession[]
  /** Séances déjà passées (ou du jour avec une course) */
  planned: number
  done: number
  short: number
  failed: number
  skipped: number
  /** Séances encore à venir dans la semaine (aujourd'hui compris, sans course) */
  ahead: number
}

/**
 * Plan suivi d'une semaine (lundi « from » → dimanche). Même règle que `adherence` : une séance compte
 * dès qu'elle est passée, ou le jour même si une course y est reliée ; une course reliée sans issue connue
 * est faite.
 */
export function weekPlan(
  sessions: { id: string; date: string; title: string }[],
  byRun: Record<string, string>,
  outcomes: Record<string, Outcome | null | undefined>,
  from: string,
  today: string,
): WeekPlan {
  const to = shift(from, 6)
  const runOf = new Map(Object.entries(byRun).map(([run, session]) => [session, run]))
  const out: WeekPlan = { sessions: [], planned: 0, done: 0, short: 0, failed: 0, skipped: 0, ahead: 0 }
  for (const s of [...sessions].sort((a, b) => a.date.localeCompare(b.date))) {
    if (s.date < from || s.date > to) continue
    const run = runOf.get(s.id) ?? null
    let status: WeekSessionStatus
    if (run) status = outcomes[run] ?? 'done'
    else if (s.date < today) status = 'skipped'
    else status = s.date === today ? 'today' : 'upcoming'
    out.sessions.push({ id: s.id, date: s.date, title: s.title, status, runId: run })
    if (status === 'today' || status === 'upcoming') out.ahead++
    else {
      out.planned++
      out[status]++
    }
  }
  return out
}

/* ───── Ce qui part chez l'IA ───── */

export interface ReviewPlan {
  planned: number
  done: number
  short: number
  failed: number
  skipped: number
  /** « lun. : Footing 45’ — faite » */
  sessions: { day: string; title: string; status: WeekSessionStatus }[]
}

export interface ReviewFeeling {
  day: string
  title: string
  rpe: number
}

/**
 * Contexte du bilan envoyé à l'IA : le plan suivi (titres de séance et issues) et les ressentis sur 10.
 * Les débriefs sont lus champ par champ : leur note écrite n'est jamais reprise.
 */
export function reviewContext(i: {
  plan: WeekPlan | null
  runs: { id: string; localDate: string; title: string }[]
  debriefs: Record<string, { rpe?: number | null; note?: string } | null | undefined>
}): { plan?: ReviewPlan; feelings?: ReviewFeeling[] } {
  const out: { plan?: ReviewPlan; feelings?: ReviewFeeling[] } = {}
  const p = i.plan
  if (p && p.sessions.length) {
    out.plan = {
      planned: p.planned,
      done: p.done,
      short: p.short,
      failed: p.failed,
      skipped: p.skipped,
      sessions: p.sessions.map((s) => ({ day: s.date, title: s.title, status: s.status })),
    }
  }
  const feelings: ReviewFeeling[] = []
  for (const r of i.runs) {
    const rpe = Number(i.debriefs[r.id]?.rpe)
    if (Number.isInteger(rpe) && rpe >= 1 && rpe <= 10) feelings.push({ day: r.localDate, title: r.title, rpe })
  }
  if (feelings.length) out.feelings = feelings
  return out
}

const STATUS_TEXT: Record<WeekSessionStatus, string> = {
  done: 'faite',
  short: 'écourtée',
  failed: 'ratée',
  skipped: 'sautée',
  today: 'prévue aujourd’hui',
  upcoming: 'à venir',
}

const clean = (s: unknown, max: number) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
const count = (n: unknown) => {
  const v = Math.round(Number(n))
  return Number.isFinite(v) && v >= 0 && v <= 50 ? v : 0
}

/**
 * Lignes de contexte pour l'IA, côté serveur, à partir de ce que le navigateur a envoyé (lecture défensive :
 * champs inconnus ignorés, textes bornés, aucune note écrite acceptée).
 */
export function reviewContextLines(body: { plan?: unknown; feelings?: unknown } | null | undefined): string[] {
  const lines: string[] = []
  const plan = body?.plan as Partial<ReviewPlan> | undefined
  if (plan && typeof plan === 'object') {
    const planned = count(plan.planned)
    if (planned) {
      lines.push(
        `Plan suivi : ${count(plan.done)} séances faites, ${count(plan.short)} écourtées, ${count(plan.failed)} ratées, ${count(plan.skipped)} sautées, sur ${planned} prévues.`,
      )
    }
    const sessions = Array.isArray(plan.sessions) ? plan.sessions.slice(0, 14) : []
    const items = sessions
      .map((s) => {
        const st = (s as { status?: unknown })?.status
        const status = typeof st === 'string' && st in STATUS_TEXT ? STATUS_TEXT[st as WeekSessionStatus] : ''
        const title = clean((s as { title?: unknown })?.title, 80)
        const day = isDay((s as { day?: unknown })?.day) ? (s as { day: string }).day : ''
        return title && status ? `${day ? `${day} ` : ''}${title} (${status})` : ''
      })
      .filter(Boolean)
    if (items.length) lines.push(`Séances prévues cette semaine : ${items.join(' ; ')}`)
  }
  const feelings = Array.isArray(body?.feelings) ? body.feelings.slice(0, 14) : []
  const f = feelings
    .map((x) => {
      const rpe = Number((x as { rpe?: unknown })?.rpe)
      if (!Number.isInteger(rpe) || rpe < 1 || rpe > 10) return ''
      const title = clean((x as { title?: unknown })?.title, 80)
      const day = isDay((x as { day?: unknown })?.day) ? (x as { day: string }).day : ''
      return `${[day, title].filter(Boolean).join(' ')} : ${rpe}/10`
    })
    .filter(Boolean)
  if (f.length) lines.push(`Ressenti du coureur (effort perçu sur 10) : ${f.join(' ; ')}`)
  return lines
}
