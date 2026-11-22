import { describe, expect, it } from 'vitest'
import { comparePlan, type Lap, type StepResult } from '../shared/utils/compliance'
import { buildDemo } from '../shared/utils/demo'
import { autoKmLaps, clock, groupSteps, hrBounds, lapDetail, lapProfile, seriesPath, stepDone, tickLabel, timeTicks, valueAt, zoneShares } from '../shared/utils/runchart'
import type { PlanStep } from '../shared/utils/workout'

/* Tours et séances INVENTÉS. */
const lap = (m: number, sec: number, hr: number | null = 150): Lap => ({ m, sec, elapsedSec: sec, hr, maxHr: hr === null ? null : hr + 8 })
const st = (kind: PlanStep['kind'], sec: number | null, m: number | null = null): PlanStep => ({ kind, sec, m })
const rep = (reps: number, ...children: PlanStep[]): PlanStep => ({ kind: 'repeat', sec: null, m: null, reps, children })

// Échauffement 10 min + 4 × (400 m / 1 min) + retour au calme 5 min ; seulement 3 efforts faits
const PLAN: PlanStep[] = [st('warmup', 600), rep(4, st('interval', null, 400), st('recovery', 60)), st('cooldown', 300)]
const WARM = [lap(1000, 400, 125), lap(500, 200, 130)]
const efforts = (n: number) => Array.from({ length: n }, (_, i) => [lap(400, 110 + i, 170 + i), lap(130, 60, 150)]).flat()
const laps3 = [...WARM, ...efforts(3)]
const run = (laps: Lap[]) => ({ durationSec: laps.reduce((s, l) => s + l.sec, 0), distanceM: laps.reduce((s, l) => s + l.m, 0), laps })
const result3 = comparePlan({ steps: PLAN }, run(laps3))!

describe('clock / tickLabel', () => {
  it('écrit les durées', () => {
    expect(clock(119)).toBe('1:59')
    expect(clock(3725)).toBe('1:02:05')
    expect(tickLabel(0)).toBe('0')
    expect(tickLabel(600)).toBe('10 min')
    expect(tickLabel(3600)).toBe('1 h')
    expect(tickLabel(5400)).toBe('1 h 30')
  })
})

describe('lapProfile', () => {
  it('une barre par tour, de largeur sa durée, plus haute quand plus rapide', () => {
    const p = lapProfile([lap(1000, 400), lap(1000, 300), lap(1000, 360)])
    expect(p.bars.map((b) => [b.t0, b.sec])).toEqual([[0, 400], [400, 300], [700, 360]])
    expect(p.total).toBe(1060)
    expect(p.ran).toBe(1060)
    expect(p.linked).toBe(false)
    const [slow, fast, mid] = p.bars
    expect(fast!.level).toBe(1)
    expect(slow!.level).toBeCloseTo(0.2)
    expect(mid!.level).toBeGreaterThan(slow!.level)
    expect(fast!.tier).toBe(3)
    expect(slow!.tier).toBe(0)
    expect(p.bars.map((b) => b.label)).toEqual(['Tour 1', 'Tour 2', 'Tour 3'])
  })

  it('sans tours, ou avec des tours illisibles : rien', () => {
    expect(lapProfile(null).bars).toEqual([])
    expect(lapProfile([{ m: Number.NaN, sec: 0 } as unknown as Lap]).bars).toEqual([])
    expect(lapProfile(undefined).total).toBe(1)
  })

  it('séance reliée : chaque tour prend la nature de son étape, les étapes pas faites deviennent des fantômes', () => {
    const p = lapProfile(laps3, result3.steps)
    expect(p.linked).toBe(true)
    expect(p.bars.slice(0, 2).map((b) => [b.kind, b.label, b.part])).toEqual([
      ['warmup', 'Échauffement', '1/2'],
      ['warmup', 'Échauffement', '2/2'],
    ])
    expect(p.bars[2]).toMatchObject({ kind: 'interval', label: 'Effort 1', state: 'done', part: null })
    expect(p.bars[3]).toMatchObject({ kind: 'recovery', label: 'Récup 1' })
    const ghosts = p.bars.filter((b) => b.state === 'missed')
    expect(ghosts.map((g) => g.label)).toEqual(['Effort 4', 'Récup 4', 'Retour au calme'])
    expect(ghosts[0]!.planned).toBe('400 m')
    expect(ghosts[0]!.t0).toBe(p.ran)
    // Un effort fantôme a la hauteur moyenne des efforts faits
    const done = p.bars.filter((b) => b.kind === 'interval' && b.state === 'done')
    expect(ghosts[0]!.level).toBeCloseTo(done.reduce((s, b) => s + b.level, 0) / done.length)
    expect(p.total).toBeGreaterThan(p.ran)
  })

  it('un footing (une seule nature d’étape) reste coloré par intensité', () => {
    const laps = [lap(1000, 400), lap(1000, 390), lap(1000, 395)]
    const r = comparePlan({ steps: [st('other', 1185)] }, run(laps))!
    const p = lapProfile(laps, r.steps)
    expect(p.linked).toBe(false)
    expect(p.bars.every((b) => b.kind === null && b.label.startsWith('Tour'))).toBe(true)
  })

  it('séance de démo d’hier : 5 efforts faits, le 6ᵉ entamé, puis les fantômes', () => {
    const demo = buildDemo('2026-11-22')
    const a2 = demo.activities.find((a) => a.id === 'a2')!
    const s = demo.plan.find((x) => x.date === a2.localDate)!
    const r = comparePlan(s, { durationSec: a2.durationSec, distanceM: a2.distanceKm * 1000, laps: a2.laps })!
    const p = lapProfile(a2.laps, r.steps)
    expect(p.linked).toBe(true)
    expect(p.bars.filter((b) => b.kind === 'interval' && b.state === 'done')).toHaveLength(5)
    expect(p.bars.find((b) => b.state === 'partial')?.label).toBe('Effort 6')
    expect(p.bars.filter((b) => b.state === 'missed' && b.kind === 'interval').map((b) => b.label)).toEqual(['Effort 6', 'Effort 7', 'Effort 8'])
  })
})

describe('lapDetail', () => {
  it('détail d’un tour, d’un tour dans une étape, d’une étape pas faite', () => {
    const p = lapProfile(laps3, result3.steps)
    expect(lapDetail(p.bars[2]!)).toBe('Effort 1 · 400 m · 1:50 · 4:35 /km · 170 bpm')
    expect(lapDetail(p.bars[0]!)).toBe('Échauffement (1/2) · 1 km · 6:40 · 6:40 /km · 125 bpm')
    expect(lapDetail(p.bars.find((b) => b.state === 'missed')!)).toBe('Effort 4 · 400 m prévus · pas fait')
    expect(lapDetail({ ...p.bars[2]!, hr: null, label: 'Tour 3' })).toBe('Tour 3 · 400 m · 1:50 · 4:35 /km')
  })
})

describe('timeTicks', () => {
  it('graduations régulières, sans libellé collé à la fin', () => {
    expect(timeTicks(1800).map((t) => t.label)).toEqual(['0', '10 min', '20 min'])
    expect(timeTicks(2700).map((t) => t.t)).toEqual([0, 600, 1200, 1800, 2400])
    expect(timeTicks(5000).map((t) => t.label)).toEqual(['0', '20 min', '40 min', '1 h'])
    expect(timeTicks(0)).toEqual([])
    for (const tk of timeTicks(2000)) expect(tk.x).toBeLessThan(0.9)
  })
})

describe('seriesPath / hrBounds / valueAt', () => {
  it('met la courbe à l’échelle et saute les trous', () => {
    const { line, area } = seriesPath([0, 50, 100], [100, 0, 200], { total: 100, lo: 100, hi: 200, w: 1000, h: 100 })
    expect(line).toBe('M0 100L1000 0')
    expect(area).toBe('M0 100L1000 0L1000 100L0 100Z')
    expect(seriesPath([0], [120], { total: 10, lo: 0, hi: 1, w: 1, h: 1 }).line).toBe('')
    expect(seriesPath(null, null, { total: 10, lo: 0, hi: 1, w: 1, h: 1 })).toEqual({ line: '', area: '' })
  })

  it('bornes arrondies à 5 bpm avec de l’air', () => {
    expect(hrBounds([121, 150, 178])).toEqual({ lo: 110, hi: 185 })
    expect(hrBounds([140, 141])).toEqual({ lo: 130, hi: 150 })
    expect(hrBounds([0, 0])).toBeNull()
    expect(hrBounds(null)).toBeNull()
  })

  it('valeur la plus proche d’un instant', () => {
    expect(valueAt([0, 10, 20], [120, 130.4, 140], 12)).toBe(130)
    expect(valueAt([0, 10], [0, 0], 5)).toBeNull()
  })
})

describe('zoneShares', () => {
  it('pourcentages entiers dont la somme fait 100', () => {
    const z = zoneShares([100, 100, 100, 0, 0])
    expect(z.map((x) => x.pct)).toEqual([34, 33, 33, 0, 0])
    expect(z.reduce((s, x) => s + x.pct, 0)).toBe(100)
    expect(zoneShares([0, 0, 0, 0, 0]).every((x) => x.pct === 0)).toBe(true)
    expect(zoneShares(null)).toEqual([])
  })
})

describe('groupSteps / stepDone', () => {
  it('regroupe les répétitions comme le plan', () => {
    const rows = groupSteps(PLAN, result3.steps)!
    expect(rows.map((r) => r.type)).toEqual(['step', 'repeat', 'step'])
    const repRow = rows[1]!
    if (repRow.type !== 'repeat') throw new Error('répétition attendue')
    expect(repRow.label).toBe('4 × 400 m, récup 1 min')
    expect(repRow.items).toHaveLength(8)
    expect(repRow.efforts.map((e) => e.label)).toEqual(['Effort 1', 'Effort 2', 'Effort 3', 'Effort 4'])
    expect(repRow.efforts.map((e) => e.result.done)).toEqual([true, true, true, false])
  })

  it('plan et résultats qui ne correspondent pas : null', () => {
    expect(groupSteps(PLAN, result3.steps.slice(0, 3))).toBeNull()
    expect(groupSteps([], result3.steps)).toBeNull()
    expect(groupSteps(PLAN, [])).toBeNull()
  })

  it('jamais de chiffre estimé', () => {
    const base: StepResult = { kind: 'interval', planned: { sec: null, m: 400 }, done: true, fraction: 1, actual: { sec: 110, m: 400, hr: 170 }, exact: true }
    expect(stepDone(base)).toBe('1:50 · 4:35 /km · 170 bpm')
    expect(stepDone({ ...base, exact: false })).toBe('fait')
    expect(stepDone({ ...base, done: false, fraction: 0.4, exact: false })).toBe('arrêté en cours')
    expect(stepDone({ ...base, done: false, fraction: 0, actual: null, exact: false })).toBe('pas fait')
  })
})

describe('autoKmLaps', () => {
  it('reconnaît les tours du kilomètre automatique', () => {
    expect(autoKmLaps([lap(1000, 300), lap(1003, 310), lap(640, 200)])).toBe(true)
    expect(autoKmLaps([lap(1000, 300), lap(400, 110), lap(1000, 300)])).toBe(false)
    expect(autoKmLaps([lap(1000, 300)])).toBe(false)
    expect(autoKmLaps(null)).toBe(false)
  })
})
