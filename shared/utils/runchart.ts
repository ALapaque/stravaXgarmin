/*
 * Géométrie des graphiques d'une course : profil des tours (un tour = une barre), étapes prévues
 * regroupées, axe du temps, courbes mises à l'échelle, temps par zone.
 * Logique pure, testée (tests/runchart.test.ts). Aucune couleur ici : les composants choisissent
 * leurs teintes dans les variables des thèmes d'après « kind » et « tier ».
 */
import type { Lap, StepResult } from './compliance'
import type { RunStream } from './streams'
import { paceText, plannedAmount, plannedSeconds, STEP_LEVEL, stepLabel } from './debrief'
import { stepDistance, stepsSummary, type PlanStep, type StepKind } from './workout'

/** 141 → « 2:21 », 3725 → « 1:02:05 » */
export function clock(sec: number): string {
  const s = Math.max(0, Math.round(sec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0)

/* ───── Profil des tours ───── */

export interface LapBar {
  /** Numéro du tour (0…), -1 pour une étape prévue pas faite (fantôme) */
  lap: number
  /** Début et durée sur l'axe du temps (s) */
  t0: number
  sec: number
  m: number
  hr: number | null
  /** Hauteur relative, de 0 à 1 : la vitesse du tour (plus haut = plus rapide) */
  level: number
  /** Intensité en 4 paliers (0 = le plus lent), pour colorer sans séance reliée */
  tier: 0 | 1 | 2 | 3
  /** Nature de l'étape quand la séance est reliée ; null sans séance ou hors séance */
  kind: StepKind | null
  /** done : couru ; partial : étape entamée puis arrêtée ; missed : prévu, pas fait */
  state: 'done' | 'partial' | 'missed'
  /** « Effort 3 », « Échauffement », « Tour 7 », « Hors séance » */
  label: string
  /** « 2/3 » quand l'étape couvre plusieurs tours */
  part: string | null
  /** Quantité prévue d'une étape pas faite (« 400 m ») */
  planned: string | null
}

export interface LapProfile {
  bars: LapBar[]
  /** Longueur de l'axe du temps (couru + prévu pas fait) */
  total: number
  /** Temps réellement couru (somme des tours) */
  ran: number
  /** Barres colorées par nature d'étape (séance reliée et au moins deux natures d'étapes courues) */
  linked: boolean
}

/** Numéros « Effort 3 », « Récup 2 » : comptés sur toute la séance, par nature d'étape. */
function stepNames(steps: StepResult[]): string[] {
  const count: Partial<Record<StepKind, number>> = {}
  const totals: Partial<Record<StepKind, number>> = {}
  for (const s of steps) totals[s.kind] = (totals[s.kind] ?? 0) + 1
  return steps.map((s) => {
    count[s.kind] = (count[s.kind] ?? 0) + 1
    const numbered = s.kind === 'interval' || s.kind === 'recovery' || s.kind === 'rest' || (totals[s.kind] ?? 0) > 1
    return numbered ? `${stepLabel(s.kind)} ${count[s.kind]}` : stepLabel(s.kind)
  })
}

/**
 * Une barre par tour de la montre (largeur = durée, hauteur = vitesse). Avec les étapes de la séance
 * reliée (posées sur les tours, avec leur début « at »), chaque tour prend la nature de l'étape qui
 * contient son milieu, et les étapes pas faites s'ajoutent à la fin en fantômes. Les étapes ne servent
 * que si au moins deux natures d'étapes ont été courues (un footing reste coloré par intensité).
 */
export function lapProfile(laps: Lap[] | null | undefined, steps?: StepResult[] | null): LapProfile {
  const raw = (Array.isArray(laps) ? laps : []).map((l) => ({ m: num(l?.m), sec: num(l?.sec), hr: num(l?.hr) || null })).filter((l) => l.sec > 0)

  const run = (Array.isArray(steps) ? steps : []).filter((s) => s && s.actual && s.actual.sec > 0 && typeof s.at === 'number')
  const linked = run.length > 0 && new Set(run.map((s) => s.kind)).size > 1
  const all = Array.isArray(steps) ? steps : []
  const names = linked ? stepNames(all) : []

  // Étape qui contient un instant donné (index dans « all »)
  const stepAt = (t: number) => all.findIndex((s) => s.actual && s.actual.sec > 0 && typeof s.at === 'number' && t >= s.at && t < s.at + s.actual.sec)

  /*
   * Tours regroupés avant le dessin. La montre laisse de petits fragments (bouton pressé, arrêt : quelques
   * secondes, quelques mètres) qui feraient des barres minuscules aux allures absurdes :
   * - un fragment rejoint le tour voisin de la même étape ;
   * - une étape entamée puis arrêtée devient une seule barre, quel que soit le nombre de tours qu'elle a laissés.
   * Un tour court qui est à lui seul une étape faite (une ligne droite de 15 s) n'est jamais fondu dans une autre étape.
   */
  const fragment = (l: { m: number; sec: number }) => l.sec < 10 || l.m < 30
  const list: { m: number; sec: number; hr: number | null; first: number; owner: number; onlyFragments: boolean }[] = []
  let at = 0
  raw.forEach((l, i) => {
    const owner = linked ? stepAt(at + l.sec / 2) : -1
    at += l.sec
    const last = list[list.length - 1]
    const partial = owner >= 0 && !all[owner]!.done
    if (last && last.owner === owner && (partial || fragment(l) || last.onlyFragments)) {
      const hrSec = (last.hr ? last.sec : 0) + (l.hr ? l.sec : 0)
      last.hr = hrSec ? Math.round(((last.hr ?? 0) * (last.hr ? last.sec : 0) + (l.hr ?? 0) * (l.hr ? l.sec : 0)) / hrSec) : null
      last.m += l.m
      last.sec += l.sec
      last.onlyFragments = last.onlyFragments && fragment(l)
    } else {
      list.push({ ...l, first: i, owner, onlyFragments: fragment(l) })
    }
  })

  const speeds = list.filter((l) => l.sec >= 10 && l.m > 0).map((l) => l.m / l.sec)
  const vMin = speeds.length ? Math.min(...speeds) : 0
  const vMax = speeds.length ? Math.max(...speeds) : 0
  const rel = (v: number) => (vMax > vMin ? Math.min(1, Math.max(0, (v - vMin) / (vMax - vMin))) : 0.6)
  const levelOf = (l: { m: number; sec: number }) => (l.m > 0 ? Math.max(0.06, Math.min(1, 0.2 + 0.8 * rel(l.m / l.sec))) : 0.06)
  const tierOf = (l: { m: number; sec: number }) => (l.m > 0 ? (Math.min(3, Math.floor(rel(l.m / l.sec) * 4)) as 0 | 1 | 2 | 3) : 0)

  const bars: LapBar[] = []
  /** Étape de chaque barre (index dans « all », -1 : aucune) */
  const owner: number[] = []
  let t = 0
  list.forEach((l, i) => {
    const idx = l.owner
    const s = idx >= 0 ? all[idx]! : null
    owner.push(idx)
    bars.push({
      lap: l.first,
      t0: t,
      sec: l.sec,
      m: l.m,
      hr: l.hr,
      level: levelOf(l),
      tier: tierOf(l),
      kind: s ? s.kind : null,
      state: s && !s.done ? 'partial' : 'done',
      label: s ? names[idx]! : linked ? 'Hors séance' : `Tour ${i + 1}`,
      part: null,
      planned: null,
    })
    t += l.sec
  })
  const ran = t

  // « 2/3 » : un tour parmi plusieurs dans la même étape
  for (const k of new Set(owner)) {
    if (k < 0) continue
    const group = bars.filter((_, j) => owner[j] === k)
    if (group.length > 1) group.forEach((b, j) => (b.part = `${j + 1}/${group.length}`))
  }

  // Étapes pas faites (ou la fin d'une étape entamée) : fantômes après la fin de la course
  if (linked) {
    const avgLevel = (k: StepKind) => {
      const same = bars.filter((b) => b.kind === k && b.state === 'done' && b.sec >= 10)
      return same.length ? same.reduce((a, b) => a + b.level, 0) / same.length : (STEP_LEVEL[k] ?? 0.5)
    }
    all.forEach((s, idx) => {
      if (s.done) return
      const left = plannedSeconds(s) - (s.actual?.sec ?? 0)
      if (left < 1) return
      bars.push({ lap: -1, t0: t, sec: left, m: 0, hr: null, level: avgLevel(s.kind), tier: 0, kind: s.kind, state: 'missed', label: names[idx]!, part: null, planned: plannedAmount(s.planned) })
      t += left
    })
  }

  return { bars, total: Math.max(t, 1), ran, linked }
}

/** « 400 m », « 1 km », « 1,02 km » */
const lapDistance = (m: number) => (m < 1000 ? `${Math.round(m)} m` : stepDistance(m))

/** Détail d'une barre : « Effort 3 · 400 m · 1:59 · 4:58 /km · 172 bpm » ; « Effort 7 · 400 m prévus · pas fait ». */
export function lapDetail(b: LapBar): string {
  const name = `${b.label}${b.part ? ` (${b.part})` : ''}`
  if (b.state === 'missed') return `${name} · ${b.planned ? `${b.planned} prévus · ` : ''}pas fait`
  const bits = [b.state === 'partial' ? `${name}, arrêté en cours` : name]
  if (b.m > 0) bits.push(lapDistance(b.m))
  bits.push(clock(b.sec))
  // Pas d'allure pour quelques secondes ou pour un tour presque à l'arrêt (plus lent que 15 min/km) : elle ne dit rien
  const pace = paceText(b.sec, b.m)
  if (pace && b.sec >= 10 && b.m / b.sec >= 1000 / 900) bits.push(pace)
  if (b.hr) bits.push(`${b.hr} bpm`)
  return bits.join(' · ')
}

/* ───── Axe du temps ───── */

const STEPS = [60, 120, 300, 600, 900, 1200, 1800, 3600, 5400, 7200]

/** « 0 », « 10 min », « 1 h », « 1 h 30 » */
export function tickLabel(sec: number): string {
  if (sec <= 0) return '0'
  const m = Math.round(sec / 60)
  if (m < 60) return `${m} min`
  return m % 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}` : `${m / 60} h`
}

/**
 * Graduations régulières de l'axe du temps, « max » au plus ; « x » de 0 à 1.
 * La dernière graduation laisse de la place à la fin de l'axe (pas de libellé coupé).
 */
export function timeTicks(total: number, max = 5): { t: number; x: number; label: string }[] {
  if (!(total > 0)) return []
  const step = STEPS.find((s) => total / s <= max) ?? Math.ceil(total / max / 3600) * 3600
  const out: { t: number; x: number; label: string }[] = []
  for (let t = 0; t <= total - step * 0.4; t += step) out.push({ t, x: t / total, label: tickLabel(t) })
  return out
}

/* ───── Courbes ───── */

export interface Scale {
  /** Temps total de l'axe (s) */
  total: number
  lo: number
  hi: number
  w: number
  h: number
}

const r1 = (v: number) => Math.round(v * 10) / 10

/**
 * Ligne et aire d'une courbe (« t » en s, « v » ses valeurs) dans un repère w × h : temps → x,
 * valeur → y (lo en bas, hi en haut). Les points sans valeur (0 ou moins) sont sautés.
 */
export function seriesPath(t: number[] | null | undefined, v: number[] | null | undefined, s: Scale): { line: string; area: string } {
  const ts = Array.isArray(t) ? t : []
  const vs = Array.isArray(v) ? v : []
  const span = s.hi - s.lo || 1
  const pts: [number, number][] = []
  for (let i = 0; i < ts.length && i < vs.length; i++) {
    const val = vs[i]!
    if (!(val > 0) || !Number.isFinite(ts[i]!)) continue
    const x = (Math.min(Math.max(ts[i]!, 0), s.total) / s.total) * s.w
    const y = s.h - ((Math.min(Math.max(val, s.lo), s.hi) - s.lo) / span) * s.h
    pts.push([r1(x), r1(y)])
  }
  if (pts.length < 2) return { line: '', area: '' }
  const line = `M${pts.map(([x, y]) => `${x} ${y}`).join('L')}`
  const area = `${line}L${pts[pts.length - 1]![0]} ${s.h}L${pts[0]![0]} ${s.h}Z`
  return { line, area }
}

/** Bornes de l'échelle de fréquence cardiaque : un peu d'air autour des valeurs, arrondi à 5 bpm. */
export function hrBounds(hr: number[] | null | undefined): { lo: number; hi: number } | null {
  const vals = (Array.isArray(hr) ? hr : []).filter((v) => v > 30 && v < 250)
  if (vals.length < 2) return null
  const lo = Math.floor((Math.min(...vals) - 8) / 5) * 5
  const hi = Math.ceil((Math.max(...vals) + 4) / 5) * 5
  return { lo: Math.max(30, lo), hi: Math.max(hi, lo + 20) }
}

/** Valeur d'une courbe la plus proche d'un instant (null sans valeur). */
export function valueAt(t: number[] | null | undefined, v: number[] | null | undefined, at: number): number | null {
  const ts = Array.isArray(t) ? t : []
  const vs = Array.isArray(v) ? v : []
  let best = -1
  let diff = Infinity
  for (let i = 0; i < ts.length && i < vs.length; i++) {
    const d = Math.abs(ts[i]! - at)
    if (d < diff && vs[i]! > 0) {
      diff = d
      best = i
    }
  }
  return best >= 0 ? Math.round(vs[best]!) : null
}

/* ───── Légende du profil ───── */

export type LegendKey = 'calm' | 'interval' | 'recovery' | 'other' | 'none' | 'partial' | 'missed'

/**
 * Ce que la légende du profil doit expliquer, dans l'ordre d'affichage : jamais la couleur seule.
 * Les natures d'étapes n'y figurent que si les barres sont colorées par étape (séance reliée).
 */
export function lapLegend(p: LapProfile): { key: LegendKey; label: string }[] {
  const out: { key: LegendKey; label: string }[] = []
  if (p.linked) {
    const kinds = new Set(p.bars.filter((b) => b.state !== 'missed').map((b) => b.kind))
    const warm = kinds.has('warmup')
    const cool = kinds.has('cooldown')
    if (warm || cool) out.push({ key: 'calm', label: warm && cool ? 'Échauffement, retour au calme' : warm ? 'Échauffement' : 'Retour au calme' })
    if (kinds.has('interval')) out.push({ key: 'interval', label: 'Effort' })
    if (kinds.has('recovery') || kinds.has('rest')) out.push({ key: 'recovery', label: 'Récup' })
    if (kinds.has('other')) out.push({ key: 'other', label: 'Course' })
    if (kinds.has(null)) out.push({ key: 'none', label: 'Hors séance' })
  }
  if (p.bars.some((b) => b.state === 'partial')) out.push({ key: 'partial', label: 'Entamé' })
  if (p.bars.some((b) => b.state === 'missed')) out.push({ key: 'missed', label: 'Pas fait' })
  return out
}

/* ───── Image à partager : ce qui remplit le cadre quand il n'y a pas de tracé ───── */

export interface ShareBar {
  /** Début et largeur sur l'axe du temps, de 0 à 1 */
  x: number
  w: number
  /** Hauteur, de 0 à 1 (plus haut = plus rapide) */
  level: number
  tier: 0 | 1 | 2 | 3
  kind: StepKind | null
  state: LapBar['state']
}

export interface ShareChart {
  /** laps : une barre par tour · splits : une barre par kilomètre · curve : le cardio seul */
  kind: 'laps' | 'splits' | 'curve'
  bars: ShareBar[]
  /** Barres colorées par nature d'étape (séance reliée) ; sinon par intensité */
  linked: boolean
  /** Cardio : points (x, y) de 0 à 1, y = 0 en bas ; null sans courbe */
  hr: [number, number][] | null
  ticks: { x: number; label: string }[]
  /** Légende : natures d'étapes, états, puis « hr » si la courbe de cardio est tracée */
  legend: { key: LegendKey | 'hr'; label: string }[]
  /** Comment lire les barres ; null sans barres */
  hint: string | null
}

/** Courbe de cardio sur un axe de « total » secondes, placée comme dans le profil de la page (en haut, au-dessus des barres lentes). */
function hrCurve(stream: RunStream | null | undefined, total: number): [number, number][] | null {
  const b = hrBounds(stream?.hr)
  if (!stream || !b || !(total > 0)) return null
  const span = b.hi - b.lo
  const lo = b.lo - span * 0.15
  const hi = b.hi + span * 0.05
  const pts: [number, number][] = []
  const hr = stream.hr ?? []
  for (let i = 0; i < stream.t.length && i < hr.length; i++) {
    const v = hr[i]!
    const t = stream.t[i]!
    if (!(v > 0) || !Number.isFinite(t)) continue
    pts.push([Math.min(Math.max(t, 0), total) / total, (Math.min(Math.max(v, lo), hi) - lo) / (hi - lo)])
  }
  return pts.length > 1 ? pts : null
}

/**
 * Le graphique d'une course sans tracé (tapis, GPS absent), pour l'image à partager : jamais un cadre vide.
 * Dans l'ordre : la séance tour par tour, comme en haut de la page (au moins deux tours) ; sinon une barre par
 * kilomètre, avec le reste de la course en dernière barre ; sinon la courbe de cardio seule ; sinon null
 * (l'image se passe alors de cadre). Rien n'est inventé : chaque barre et chaque point vient de la course.
 */
export function shareChart(i: {
  laps?: Lap[] | null
  steps?: StepResult[] | null
  stream?: RunStream | null
  /** Temps de chaque kilomètre complet (s) */
  splits?: number[] | null
  distanceKm?: number
  durationSec?: number
}): ShareChart | null {
  const build = (kind: 'laps' | 'splits', p: LapProfile, hint: string): ShareChart => {
    const hr = hrCurve(i.stream, p.total)
    return {
      kind,
      bars: p.bars.map((b) => ({ x: b.t0 / p.total, w: b.sec / p.total, level: b.level, tier: b.tier, kind: b.kind, state: b.state })),
      linked: p.linked,
      hr,
      ticks: timeTicks(p.total, 4).map((t) => ({ x: t.x, label: t.label })),
      legend: [...lapLegend(p), ...(hr ? [{ key: 'hr' as const, label: 'Cardio' }] : [])],
      hint,
    }
  }

  const byLap = lapProfile(i.laps, i.steps)
  if (byLap.bars.filter((b) => b.lap >= 0).length > 1) return build('laps', byLap, 'Plus haut = plus rapide')

  const km = (Array.isArray(i.splits) ? i.splits : []).map(num).filter((s) => s > 0)
  if (km.length > 1) {
    const pseudo: Lap[] = km.map((sec) => ({ m: 1000, sec, elapsedSec: sec, hr: null, maxHr: null }))
    // Le reste de la course après le dernier kilomètre complet, s'il compte (plus de 50 m et de 10 s)
    const restM = num(i.distanceKm) * 1000 - km.length * 1000
    const restSec = num(i.durationSec) - km.reduce((a, b) => a + b, 0)
    if (restM >= 50 && restSec >= 10) pseudo.push({ m: restM, sec: restSec, elapsedSec: restSec, hr: null, maxHr: null })
    return build('splits', lapProfile(pseudo), 'Une barre par kilomètre · plus haut = plus rapide')
  }

  const t = i.stream?.t ?? []
  const total = t.length ? Math.max(...t.filter((v) => Number.isFinite(v))) : 0
  const hr = hrCurve(i.stream, total)
  if (hr) return { kind: 'curve', bars: [], linked: false, hr, ticks: timeTicks(total, 4).map((k) => ({ x: k.x, label: k.label })), legend: [{ key: 'hr', label: 'Cardio' }], hint: null }
  return null
}

/* ───── Temps par zone ───── */

/**
 * Part de chaque zone : pourcentages entiers dont la somme fait 100 (plus forts restes).
 * « duration » : durée de la course, quand une partie du temps n'est dans aucune zone (la montre ne
 * compte pas ce qui est sous sa zone 1). Les parts sont alors prises sur la durée, arrondies vers le
 * bas comme dans Garmin Connect : leur somme ne fait pas 100, et c'est voulu.
 */
export function zoneShares(sec: number[] | null | undefined, duration?: number | null): { z: number; sec: number; pct: number }[] {
  const list = (Array.isArray(sec) ? sec : []).slice(0, 5).map((s) => num(s))
  const total = list.reduce((a, b) => a + b, 0)
  if (!total) return list.map((s, i) => ({ z: i + 1, sec: s, pct: 0 }))
  // Au moins une demi-minute hors zones : sinon c'est un simple écart d'arrondi entre deux comptages
  if (duration && duration - total >= 30) return list.map((s, i) => ({ z: i + 1, sec: s, pct: Math.floor((s / duration) * 100) }))
  const raw = list.map((s) => (s / total) * 100)
  const pct = raw.map(Math.floor)
  let left = 100 - pct.reduce((a, b) => a + b, 0)
  const order = raw.map((r, i) => [r - Math.floor(r), i] as const).sort((a, b) => b[0] - a[0])
  for (const [, i] of order) {
    if (left <= 0) break
    pct[i]!++
    left--
  }
  return list.map((s, i) => ({ z: i + 1, sec: s, pct: pct[i]! }))
}

/* ───── Prévu ↔ réalisé, répétitions regroupées ───── */

export interface PlanRowItem {
  /** « Effort 3 », « Récup 3 », « Échauffement » */
  label: string
  /** « 400 m », « 15 min » */
  planned: string
  result: StepResult
}

export type PlanRow =
  | ({ type: 'step' } & PlanRowItem)
  | {
      type: 'repeat'
      reps: number
      /** « 8 × 400 m, récup 1 min » */
      label: string
      items: PlanRowItem[]
      /** Les efforts de la répétition, dans l'ordre (une pastille chacun) */
      efforts: PlanRowItem[]
    }

/**
 * Étapes réalisées rangées comme le plan : une ligne par étape simple, une ligne par répétition
 * (« 8 × 400 m ») qui contient ses efforts et récups. Les résultats suivent l'ordre des étapes dépliées
 * (flattenSteps) ; s'ils ne correspondent pas au plan (nombre différent), null : la page montre alors
 * la liste à plat.
 */
export function groupSteps(plan: PlanStep[] | null | undefined, results: StepResult[] | null | undefined): PlanRow[] | null {
  const res = Array.isArray(results) ? results : []
  const steps = Array.isArray(plan) ? plan : []
  if (!res.length || !steps.length) return null
  const names = stepNames(res)
  let k = 0
  const take = (): PlanRowItem | null => {
    const r = res[k]
    if (!r) return null
    const item = { label: names[k]!, planned: plannedAmount(r.planned), result: r }
    k++
    return item
  }
  const inside = (list: PlanStep[], out: PlanRowItem[]): boolean => {
    for (const s of list) {
      if (s.kind === 'repeat') {
        const reps = Math.max(0, Math.floor(s.reps ?? 1))
        for (let i = 0; i < reps; i++) if (!inside(s.children ?? [], out)) return false
        continue
      }
      const it = take()
      if (!it) return false
      out.push(it)
    }
    return true
  }
  const rows: PlanRow[] = []
  for (const s of steps) {
    if (s.kind === 'repeat') {
      const items: PlanRowItem[] = []
      if (!inside([s], items)) return null
      rows.push({ type: 'repeat', reps: Math.max(0, Math.floor(s.reps ?? 1)), label: stepsSummary([s]), items, efforts: items.filter((i) => i.result.kind === 'interval') })
      continue
    }
    const it = take()
    if (!it) return null
    rows.push({ type: 'step', ...it })
  }
  return k === res.length ? rows : null
}

/**
 * Ce qui a été fait pendant une étape : « 20:01 · 7:45 /km · 128 bpm » quand ses chiffres sont
 * ceux de la montre (exact) ; sinon « fait », « arrêté en cours » ou « pas fait » (jamais de chiffre estimé).
 */
export function stepDone(r: StepResult): string {
  if (r.done && r.exact && r.actual && r.actual.sec > 0) {
    const pace = paceText(r.actual.sec, r.actual.m)
    return [clock(r.actual.sec), pace, r.actual.hr ? `${r.actual.hr} bpm` : ''].filter(Boolean).join(' · ')
  }
  if (r.done) return 'fait'
  if (r.fraction > 0) return 'arrêté en cours'
  return 'pas fait'
}

/**
 * Tours posés seulement par le tour automatique de 1 km (le dernier peut être plus court) :
 * le tableau des tours répéterait alors les kilomètres.
 */
export function autoKmLaps(laps: Lap[] | null | undefined): boolean {
  const list = (Array.isArray(laps) ? laps : []).filter((l) => num(l?.sec) > 0)
  if (list.length < 2) return false
  return list.every((l, i) => Math.abs(num(l.m) - 1000) <= 25 || (i === list.length - 1 && num(l.m) < 1000))
}
