/*
 * Données de démo, toutes INVENTÉES et datées par rapport au jour donné (elles ne vieillissent pas).
 * Le coureur de démo suit un plan « Kiprun Pacer » (3 à 4 séances par semaine sur 6 semaines),
 * court environ 6 fois sur 10 sur tapis et titre ses courses « [SOURCE] - Titre ».
 * Déterministe : même jour → mêmes données. Logique pure, testée (tests/demo.test.ts).
 */
import type { Lap } from './compliance'
import type { Debrief } from './debrief'
import { formatDuration, formatKm } from './format'
import { parseTitle } from './titles'
import type { Activity, AppNotification, EffortKey, Forme, Gear, HistoryEntry, PlanBlock, PlanKind, PlanLine, PlanSession, Shoe, Weather } from './model'
import type { RunType } from './runs'
import { streamFromLaps, type RunStream } from './streams'
import { flattenSteps, stepDistance, stepDuration, type PlanStep } from './workout'

/** À changer quand la forme des données de démo change : une démo gardée plus ancienne est régénérée. */
export const DEMO_VERSION = 4

export const DEMO_SHOES: Record<'peg' | 'vf', Shoe> = {
  peg: { name: 'Nike Pegasus 41', km: 612 },
  vf: { name: 'Nike Vaporfly 3', km: 188 },
}

export interface DemoData {
  activities: Activity[]
  plan: PlanSession[]
  debriefs: Record<string, Debrief>
  /** Seules les courses après cette date réclament un débrief (en démo : la course d'hier) */
  debriefSince: string
  history: HistoryEntry[]
  notifications: AppNotification[]
  gear: Gear[]
  forme: Forme
}

/* ───── Dates ───── */

const DAY = 86_400_000

function shift(day: string, n: number) {
  const d = new Date(`${day}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** Décalage de Bruxelles (en heures) ce jour-là : 1 en hiver, 2 en été. */
function brusselsOffset(day: string) {
  const h = new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Europe/Brussels' })
    .formatToParts(new Date(`${day}T12:00:00Z`))
    .find((p) => p.type === 'hour')?.value
  return Number(h) - 12
}

/** Instant ISO (UTC) d'une heure de Bruxelles. */
function at(day: string, hh: number, mm = 0) {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number]
  return new Date(Date.UTC(y, m - 1, d, hh - brusselsOffset(day), mm)).toISOString()
}

const later = (iso: string, minutes: number) => new Date(Date.parse(iso) + minutes * 60_000).toISOString()

/* ───── Générateur pseudo-aléatoire à graine fixe ───── */

function prng(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hash(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

/* ───── Tours, comme une montre les découpe ───── */

const lap = (m: number, sec: number, hr: number | null, peak = 6): Lap => ({
  m: Math.round(m),
  sec: Math.round(sec),
  elapsedSec: Math.round(sec),
  hr: hr === null ? null : Math.round(hr),
  maxHr: hr === null ? null : Math.round(hr + peak),
})

/**
 * Étape en temps, découpée par le tour automatique de 1 km : la somme des tours fait exactement « sec »
 * (la fin d'étape crée un tour). « pace » en s/km, la FC dérive de « drift » par kilomètre.
 */
function timed(sec: number, pace: number, hr0: number, drift: number, rand: () => number): Lap[] {
  const out: Lap[] = []
  let left = sec
  let hr = hr0
  for (;;) {
    const p = pace * (1 + (rand() - 0.5) * 0.04)
    if (left <= p + 15) {
      out.push(lap((left / p) * 1000, left, hr))
      return out
    }
    out.push(lap(1000, Math.round(p), hr))
    left -= Math.round(p)
    hr += drift
  }
}

/** Étape en distance : tours de 1 km et le reste. */
function steady(m: number, pace: number, hr0: number, drift: number, rand: () => number): Lap[] {
  const out: Lap[] = []
  let left = m
  let hr = hr0
  while (left > 1000.5) {
    out.push(lap(1000, pace * (1 + (rand() - 0.5) * 0.04), hr))
    left -= 1000
    hr += drift
  }
  out.push(lap(left, (left / 1000) * pace, hr))
  return out
}

type DemoKind = 'easy' | 'long' | 'tempo' | 'interval'

/** Allures (s/km) et FC d'un coureur tranquille. */
const PACE = { warmup: 420, cooldown: 430, easy: 400, long: 410, tempo: 350, recovery: 480 }

/**
 * Tours d'une séance exécutée telle que prévue. « stop » : la course s'arrête au début de l'effort
 * numéro « after + 1 », après « partialM » mètres, en laissant des fragments de fin.
 */
function execute(steps: PlanStep[], kind: DemoKind, rand: () => number, stop?: { after: number; partialM: number; fragments: [number, number][] }): Lap[] {
  const laps: Lap[] = []
  let efforts = 0
  for (const s of flattenSteps(steps)) {
    if (s.kind === 'interval' && stop && efforts === stop.after) {
      if (stop.partialM) laps.push(lap(stop.partialM, (stop.partialM / 1000) * 305, 168))
      for (const [m, sec] of stop.fragments) laps.push(lap(m, sec, 162))
      return laps
    }
    if (s.kind === 'warmup') laps.push(...(s.sec ? timed(s.sec, PACE.warmup, 126, 3, rand) : steady(s.m ?? 2000, PACE.warmup, 126, 3, rand)))
    else if (s.kind === 'cooldown') laps.push(...(s.sec ? timed(s.sec, PACE.cooldown, 142, -3, rand) : steady(s.m ?? 1000, PACE.cooldown, 142, -3, rand)))
    else if (s.kind === 'recovery' || s.kind === 'rest') {
      const sec = s.sec ?? ((s.m ?? 200) / 1000) * PACE.recovery
      laps.push(lap(s.m ?? (sec / PACE.recovery) * 1000, sec, 148 + efforts * 0.8))
    } else if (s.kind === 'interval' && kind !== 'tempo') {
      efforts++
      const m = s.m ?? ((s.sec ?? 240) / 300) * 1000
      const pace = (m <= 400 ? 300 : m <= 800 ? 310 : 315) * (1 + (rand() - 0.5) * 0.03)
      laps.push(lap(m, s.sec ?? (m / 1000) * pace, 169 + efforts * 1.3, 7))
    } else {
      // Course continue (footing, sortie longue) ou bloc tempo
      const pace = kind === 'tempo' ? PACE.tempo : kind === 'long' ? PACE.long : PACE.easy
      const hr0 = kind === 'tempo' ? 163 : kind === 'long' ? 138 : 134
      const drift = kind === 'tempo' ? 2 : 1.2
      if (s.kind === 'interval') efforts++
      laps.push(...(s.sec ? timed(s.sec, pace, hr0, drift, rand) : steady(s.m ?? 5000, pace, hr0, drift, rand)))
    }
  }
  return laps
}

/* ───── Chiffres d'une course tirés de ses tours ───── */

function cumul(laps: Lap[]) {
  const T = [0]
  const D = [0]
  for (const l of laps) {
    T.push(T[T.length - 1]! + l.sec)
    D.push(D[D.length - 1]! + l.m)
  }
  return { T, D }
}

/** Temps cumulé à une distance donnée (allure régulière dans chaque tour). */
function timeAt(c: { T: number[]; D: number[] }, d: number) {
  for (let k = 1; k < c.D.length; k++) {
    if (d <= c.D[k]!) {
      const span = c.D[k]! - c.D[k - 1]!
      return c.T[k - 1]! + (span ? ((d - c.D[k - 1]!) / span) * (c.T[k]! - c.T[k - 1]!) : 0)
    }
  }
  return c.T[c.T.length - 1]!
}

function hrBetween(laps: Lap[], c: { T: number[] }, t0: number, t1: number) {
  let w = 0
  let s = 0
  laps.forEach((l, k) => {
    const o = Math.min(t1, c.T[k + 1]!) - Math.max(t0, c.T[k]!)
    if (o > 0 && l.hr) {
      w += o
      s += o * l.hr
    }
  })
  return w ? Math.round(s / w) : 0
}

/** Temps et FC de chaque kilomètre complet. */
function splitsOf(laps: Lap[]) {
  const c = cumul(laps)
  const total = c.D[c.D.length - 1]!
  const splits: number[] = []
  const splitHr: number[] = []
  for (let k = 1; k * 1000 <= total + 0.5; k++) {
    const t0 = timeAt(c, (k - 1) * 1000)
    const t1 = timeAt(c, k * 1000)
    splits.push(Math.round(t1 - t0))
    splitHr.push(hrBetween(laps, c, t0, t1))
  }
  return { splits, splitHr }
}

/** Meilleur temps sur une distance, départs essayés tous les 100 m. */
function bestOver(laps: Lap[], meters: number) {
  const c = cumul(laps)
  const total = c.D[c.D.length - 1]!
  if (total + 0.5 < meters) return undefined
  let best = Infinity
  for (let d0 = 0; d0 + meters <= total + 0.5; d0 += 100) best = Math.min(best, timeAt(c, Math.min(d0 + meters, total)) - timeAt(c, d0))
  return Math.round(best)
}

/* ───── Séances du plan ───── */

const st = (kind: PlanStep['kind'], sec: number | null, m: number | null = null): PlanStep => ({ kind, sec, m })
const rep = (reps: number, ...children: PlanStep[]): PlanStep => ({ kind: 'repeat', sec: null, m: null, reps, children })
const intervals = (reps: number, m: number, rest: PlanStep) => [st('warmup', 900), rep(reps, st('interval', null, m), rest), st('cooldown', 600)]

const LABEL: Record<PlanKind, string> = { warmup: 'Échauffement', cooldown: 'Retour au calme', interval: 'Effort', recovery: 'Récup', rest: 'Repos', other: 'Course' }
const LEVEL: Record<PlanKind, number> = { warmup: 0.42, cooldown: 0.38, interval: 0.9, recovery: 0.28, rest: 0.18, other: 0.55 }
const amount = (s: PlanStep) => (s.m ? stepDistance(s.m) : s.sec ? stepDuration(s.sec) : 'jusqu’au tour')
/** Vitesse supposée (m/s) pour estimer la durée d'une étape en distance */
const SPEED: Record<PlanKind, number> = { warmup: 2.4, cooldown: 2.3, interval: 3.3, recovery: 2.1, rest: 2.1, other: 2.5 }

function linesOf(steps: PlanStep[]): PlanLine[] {
  return steps.map((s) =>
    s.kind === 'repeat'
      ? { kind: 'repeat', reps: s.reps, text: `${s.reps} ×`, children: linesOf(s.children ?? []) }
      : { kind: s.kind, text: `${LABEL[s.kind]} · ${amount(s)}${s.target ? ` à ${s.target}` : ''}` },
  )
}

function session(id: string, date: string, title: string, steps: PlanStep[], workoutId: number, description: string | null = null): PlanSession {
  const flat = flattenSteps(steps)
  const blocks: PlanBlock[] = flat.map((s) => ({ kind: s.kind, sec: Math.round(s.sec ?? (s.m ?? 0) / SPEED[s.kind]), level: LEVEL[s.kind] }))
  return {
    id,
    date,
    title,
    description,
    provider: 'Kiprun Pacer',
    durationSec: blocks.reduce((t, b) => t + b.sec, 0) || null,
    distanceM: Math.round(flat.reduce((t, s) => t + (s.m ?? (s.sec ?? 0) * SPEED[s.kind]), 0) / 100) * 100 || null,
    lines: linesOf(steps),
    blocks: blocks.slice(0, 80),
    workoutId,
    steps,
  }
}

/* ───── Le scénario ───── */

interface Planned {
  /** Jours avant aujourd'hui */
  ago: number
  title: string
  kind: DemoKind
  steps: PlanStep[]
  /** Course faite : sur tapis ou dehors ; absente = séance sautée */
  run?: { indoor: boolean; id?: string; hour: number; minute: number }
}

const R1 = st('recovery', 60)
const R2 = st('recovery', 120)

/** 19 séances passées sur 6 semaines ; deux sautées (−27 et −10). */
const PAST: Planned[] = [
  { ago: 41, title: 'Footing 40’', kind: 'easy', steps: [st('other', 2400)], run: { indoor: true, hour: 18, minute: 35 } },
  { ago: 39, title: '6x800m (R=2’)', kind: 'interval', steps: intervals(6, 800, R2), run: { indoor: true, hour: 18, minute: 50 } },
  { ago: 37, title: 'Sortie longue 1h', kind: 'long', steps: [st('other', 3600)], run: { indoor: false, hour: 9, minute: 20 } },
  { ago: 34, title: 'Footing 45’', kind: 'easy', steps: [st('other', 2700)], run: { indoor: true, hour: 18, minute: 40 } },
  { ago: 32, title: 'Tempo 15’', kind: 'tempo', steps: [st('warmup', 900), st('interval', 900), st('cooldown', 600)], run: { indoor: true, hour: 19, minute: 5 } },
  { ago: 30, title: 'Sortie longue 1h05', kind: 'long', steps: [st('other', 3900)], run: { indoor: false, hour: 9, minute: 15 } },
  { ago: 27, title: 'Footing 40’', kind: 'easy', steps: [st('other', 2400)] },
  { ago: 25, title: '8x400m (R=1’)', kind: 'interval', steps: intervals(8, 400, R1), run: { indoor: true, hour: 18, minute: 45 } },
  { ago: 23, title: 'Sortie longue 1h10', kind: 'long', steps: [st('other', 4200)], run: { indoor: false, hour: 9, minute: 30 } },
  { ago: 21, title: 'Footing 30’', kind: 'easy', steps: [st('other', 1800)], run: { indoor: true, hour: 18, minute: 30 } },
  { ago: 17, title: 'Footing 40’', kind: 'easy', steps: [st('other', 2400)], run: { indoor: true, hour: 18, minute: 55 } },
  { ago: 15, title: '5x1000m (R=2’)', kind: 'interval', steps: intervals(5, 1000, R2), run: { indoor: false, hour: 18, minute: 20 } },
  { ago: 14, title: 'Sortie longue 1h15', kind: 'long', steps: [st('other', 4500)], run: { indoor: false, hour: 9, minute: 40 } },
  { ago: 12, title: '6x800m (R=2’)', kind: 'interval', steps: intervals(6, 800, R2), run: { indoor: true, hour: 18, minute: 40, id: 'a5' } },
  { ago: 10, title: 'Footing 45’', kind: 'easy', steps: [st('other', 2700)] },
  { ago: 7, title: 'Tempo 20’', kind: 'tempo', steps: [st('warmup', 900), st('interval', 1200), st('cooldown', 600)], run: { indoor: true, hour: 17, minute: 5, id: 'a4' } },
  { ago: 5, title: 'Sortie longue 1h20', kind: 'long', steps: [st('other', 4800)], run: { indoor: false, hour: 9, minute: 30, id: 'a1' } },
  { ago: 3, title: 'Footing 45’', kind: 'easy', steps: [st('other', 2700)], run: { indoor: true, hour: 7, minute: 15, id: 'a3' } },
  { ago: 1, title: '8x400m (R=1’)', kind: 'interval', steps: intervals(8, 400, R1), run: { indoor: true, hour: 18, minute: 42, id: 'a2' } },
]

/** Arrêts imposés par le scénario (identifiant de course → arrêt). */
const STOPS: Record<string, { after: number; partialM: number; fragments: [number, number][] }> = {
  // Hier : 5 efforts sur 8, puis arrêt (un fragment de fin)
  a2: { after: 5, partialM: 0, fragments: [[14, 6]] },
  // Fractionné raté : arrêté pendant le 3ᵉ effort, deux fragments de fin
  a5: { after: 2, partialM: 290, fragments: [[6, 4], [3, 2]] },
}

const SKIES = ['ensoleillé', 'nuageux', 'couvert', 'pluie fine', 'brouillard']
const RUN_REASON: Record<DemoKind, string> = { easy: 'd’après son nom', long: 'd’après son nom', tempo: 'd’après son nom', interval: 'd’après son nom' }

/** Toutes les données de démo, datées par rapport à « today » (AAAA-MM-JJ, jour de Bruxelles). */
export function buildDemo(today: string): DemoData {
  const rand = prng(42)
  const activities: Activity[] = []
  const plan: PlanSession[] = []
  const debriefs: Record<string, Debrief> = {}

  /** Une course tirée de ses tours ; « title » : titre de la séance. */
  function addRun(o: {
    id: string
    day: string
    hour: number
    minute: number
    type: RunType
    indoor: boolean
    laps: Lap[]
    stravaName: string
    garminName: string
    place: string
    reason: string
    workoutType?: number
    pauses?: number
  }) {
    const sec = o.laps.reduce((t, l) => t + l.sec, 0)
    const m = o.laps.reduce((t, l) => t + l.m, 0)
    const c = cumul(o.laps)
    const { splits, splitHr } = splitsOf(o.laps)
    const bestEfforts: Partial<Record<EffortKey, number>> = {}
    const b5 = bestOver(o.laps, 5000)
    const b10 = bestOver(o.laps, 10000)
    if (b5) bestEfforts['5k'] = b5
    if (b10) bestEfforts['10k'] = b10
    const weather: Weather | undefined = o.indoor
      ? undefined
      : { tempC: Math.round(5 + rand() * 9), sky: SKIES[Math.floor(rand() * SKIES.length)]!, windKmh: Math.round(5 + rand() * 18) }
    const a: Activity = {
      id: o.id,
      type: o.type,
      typeReason: o.reason,
      startedAt: at(o.day, o.hour, o.minute),
      localDate: o.day,
      indoor: o.indoor,
      sport: 'Run',
      place: o.indoor ? 'tapis' : o.place,
      distanceKm: Math.round(m / 100) / 10,
      durationSec: sec,
      elapsedSec: sec + (o.pauses ?? 0),
      avgHr: hrBetween(o.laps, c, 0, sec),
      maxHr: Math.max(...o.laps.map((l) => l.maxHr ?? 0)),
      elevationM: o.indoor ? 0 : Math.round(20 + rand() * 120),
      splits,
      splitHr,
      laps: o.laps,
      workoutType: o.workoutType,
      weather,
      shoe: o.type === 'race' || o.type === 'interval' ? DEMO_SHOES.vf : DEMO_SHOES.peg,
      bestEfforts,
      garminName: o.garminName,
      stravaName: o.stravaName,
    }
    activities.push(a)
    return a
  }

  PAST.forEach((p, i) => {
    const day = shift(today, -p.ago)
    const s = session(`k${p.ago}`, day, p.title, p.steps, 9100 + i)
    plan.push(s)
    if (!p.run) return
    const id = p.run.id ?? `d${p.ago}`
    const stop = STOPS[id]
    const laps = execute(p.steps, p.kind, rand, stop)
    const tagged = stop && id !== 'a2' ? `[FAIL][KIPRUN] - ${p.title}` : `[KIPRUN] - ${p.title}`
    const type: RunType = p.kind
    const a = addRun({
      id,
      day,
      hour: p.run.hour,
      minute: p.run.minute,
      type,
      indoor: p.run.indoor,
      laps,
      // Hier : pas encore débriefée, le nom par défaut de Strava est resté
      stravaName: id === 'a2' ? 'Course à pied en soirée' : tagged,
      garminName: `${p.run.indoor ? 'Tapis de course' : 'Namur'} - ${p.title}`,
      place: p.kind === 'long' ? 'chemins' : 'quais',
      reason: id === 'a2' ? 'selon ta montre' : RUN_REASON[p.kind],
      pauses: p.kind === 'interval' ? 25 : 0,
    })
    if (id === 'a2') {
      // Note personnelle (inventée) déjà sur Strava : le texte de l'appli doit se placer dessous
      a.stravaDescription = 'Séance costaud sous la pluie. Les deux derniers 400 étaient de trop, à refaire plus frais.'
      return
    }
    const failed = Boolean(stop)
    const rpe = id === 'a3' ? 3 : id === 'a1' ? 5 : failed ? 9 : { easy: 3, long: 5, tempo: 6, interval: 7 }[p.kind]
    const note = id === 'a1' ? 'Bonnes jambes jusqu’au 10ᵉ km, fin plus dure.' : failed ? 'Jambes lourdes dès le début, j’ai coupé au 3ᵉ.' : ''
    debriefs[id] = {
      status: 'done',
      outcome: failed ? 'failed' : 'done',
      rpe,
      note,
      source: 'KIPRUN',
      planId: null,
      title: p.title,
      block: null,
      at: later(a.startedAt, 90),
    }
  })

  // Compétition, il y a 20 jours : record sur 10 km
  const raceLaps = steady(10000, 336, 166, 1.2, rand)
  const race = addRun({
    id: 'd20',
    day: shift(today, -20),
    hour: 10,
    minute: 0,
    type: 'race',
    indoor: false,
    laps: raceLaps,
    stravaName: '[RACE] - 10 km des Étangs',
    garminName: 'Namur Course à pied',
    place: 'route',
    reason: 'marquée compétition sur Strava',
    workoutType: 1,
  })
  race.prs = ['5k', '10k']
  debriefs[race.id] = { status: 'done', outcome: null, rpe: 9, note: 'Objectif tenu, départ un peu rapide.', source: 'RACE', planId: 'none', title: '10 km des Étangs', block: null, at: later(race.startedAt, 120) }

  // Deux sorties libres, hors plan
  const free: [number, string, RunType, number, number][] = [
    [28, 'Côtes du dimanche', 'interval', 9, 45],
    [9, 'Footing avec le club', 'easy', 19, 0],
  ]
  for (const [ago, title, type, hour, minute] of free) {
    const laps = type === 'interval' ? [...timed(900, PACE.warmup, 128, 3, rand), ...steady(3000, 380, 158, 3, rand), ...timed(600, PACE.cooldown, 140, -2, rand)] : timed(2900, 395, 136, 1, rand)
    const a = addRun({ id: `d${ago}`, day: shift(today, -ago), hour, minute, type, indoor: false, laps, stravaName: `[CUSTOM] - ${title}`, garminName: 'Namur Course à pied', place: type === 'interval' ? 'chemins' : 'quais', reason: 'd’après son nom' })
    debriefs[a.id] = { status: 'done', outcome: null, rpe: type === 'interval' ? 7 : 4, note: '', source: 'CUSTOM', planId: 'none', title, block: null, at: later(a.startedAt, 60) }
  }

  // Meilleurs efforts : seuls ceux de la compétition battent les précédents (pas de faux records sur un footing)
  const chrono = [...activities].sort((a, b) => a.startedAt.localeCompare(b.startedAt))
  const best: Partial<Record<EffortKey, number>> = {}
  for (const a of chrono) {
    for (const k of ['5k', '10k'] as EffortKey[]) {
      const t = a.bestEfforts[k]
      if (t === undefined) continue
      const prev = best[k]
      if (prev !== undefined && t < prev && a.type !== 'race') a.bestEfforts[k] = prev + 3 + Math.round(rand() * 20)
      best[k] = Math.min(prev ?? Infinity, a.bestEfforts[k]!)
    }
  }

  // Séances à venir : une demain, puis dans 3 et 5 jours
  plan.push(
    session('p1', shift(today, 1), 'Fractionné 6 × 800 m', [st('warmup', 1200), rep(6, { ...st('interval', null, 800), target: '4:55–5:10 /km' }, R2), st('cooldown', 600)], 9001, 'Séance VMA du plan semi-marathon'),
    session('p2', shift(today, 3), 'Footing en endurance', [{ ...st('other', 2700), target: '6:30–6:50 /km' }], 9002),
    session('p3', shift(today, 5), 'Sortie longue avec allure semi', [st('warmup', 900), st('other', null, 10000), { ...st('interval', null, 3000), target: '5:40–5:55 /km' }, st('cooldown', 600)], 9003, 'Les 3 derniers km à allure course'),
  )

  // Débriefs déjà faits dont le titre Strava porte la convention : publiés sur Strava au moment du débrief
  for (const [id, d] of Object.entries(debriefs)) {
    const run = activities.find((a) => a.id === id)
    if (run && d.status === 'done' && parseTitle(run.stravaName).tagged) d.publishedAt = d.at
  }

  activities.sort((a, b) => b.startedAt.localeCompare(a.startedAt))
  plan.sort((a, b) => a.date.localeCompare(b.date))

  const byId = (id: string) => activities.find((a) => a.id === id)!
  const a1 = byId('a1')
  const a2 = byId('a2')
  const a3 = byId('a3')

  // Historique : deux titres posés à la main avec l'appli (avant la convention, Strava avait mis son nom par défaut)
  const history: HistoryEntry[] = [
    { id: 'seed-1', activityId: 'a3', field: 'name', before: 'Course à pied le matin', after: a3.stravaName, source: 'manuel', at: later(a3.startedAt, 75) },
    { id: 'seed-2', activityId: 'a1', field: 'name', before: 'Course à pied le matin', after: a1.stravaName, source: 'manuel', at: later(a1.startedAt, 100) },
  ]

  // Récap de la semaine dernière (lundi → dimanche)
  const t = new Date(`${today}T12:00:00Z`)
  const monday = new Date(t.getTime() - ((t.getUTCDay() + 6) % 7) * DAY).toISOString().slice(0, 10)
  const lastMonday = shift(monday, -7)
  const lastWeekKm = activities.filter((a) => a.localDate >= lastMonday && a.localDate < monday).reduce((s, a) => s + a.distanceKm, 0)
  const monthName = new Intl.DateTimeFormat('fr-BE', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${lastMonday}T12:00:00Z`))

  const notifications: AppNotification[] = [
    { id: 'n1', kind: 'review', title: 'Ta séance attend son débrief', body: '8x400m (R=1’)', to: '/activites/a2/debrief', at: later(a2.startedAt, 70), read: false },
    { id: 'n2', kind: 'recap', title: 'Ton récap de la semaine est prêt', body: `${formatKm(lastWeekKm)} km sur la semaine du ${monthName}.`, to: '/recap', at: at(monday, 8), read: false },
    { id: 'n3', kind: 'records', title: 'Nouveau record sur 10 km', body: `${formatDuration(race.bestEfforts['10k']!)} au 10 km des Étangs.`, to: `/activites/${race.id}`, at: later(race.startedAt, 80), read: true },
    { id: 'n4', kind: 'records', title: 'Nouveau record sur 5 km', body: `${formatDuration(race.bestEfforts['5k']!)} pendant le 10 km des Étangs.`, to: `/activites/${race.id}`, at: later(race.startedAt, 81), read: true },
  ]

  return {
    activities,
    plan,
    debriefs,
    debriefSince: at(shift(today, -2), 0),
    history,
    notifications,
    gear: [
      { id: 'g1', name: DEMO_SHOES.peg.name, km: DEMO_SHOES.peg.km, primary: true, retired: false },
      { id: 'g2', name: DEMO_SHOES.vf.name, km: DEMO_SHOES.vf.km, primary: false, retired: false },
    ],
    forme: {
      vo2max: 46,
      status: { label: 'Productif', tone: 'ok' },
      load: { acute: 380, chronic: 350, ratio: 1.09 },
      readiness: { score: 68, level: 'MODERATE' },
      recoveryHours: 14,
      predictions: { '5k': 1590, '10k': 3330, half: 7480, marathon: 15900 },
    },
  }
}

/** Courbes de démo d'une course, fabriquées à partir de ses tours (déterministes). */
export function demoStream(a: Pick<Activity, 'id' | 'laps'>): RunStream {
  return streamFromLaps(a.laps ?? [], hash(a.id))
}
