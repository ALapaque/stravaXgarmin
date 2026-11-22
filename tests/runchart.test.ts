import { describe, expect, it } from 'vitest'
import { comparePlan, type Lap, type StepResult } from '../shared/utils/compliance'
import { buildDemo } from '../shared/utils/demo'
import { autoKmLaps, clock, groupSteps, hrBounds, lapDetail, lapLegend, lapProfile, seriesPath, shareChart, stepDone, tickLabel, timeTicks, valueAt, zoneShares } from '../shared/utils/runchart'
import { streamFromLaps } from '../shared/utils/streams'
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

describe('lapProfile : fragments de tours', () => {
  it('étape entamée puis arrêtée : une seule barre, même si la montre a laissé plusieurs petits tours', () => {
    // 2 efforts faits, le 3ᵉ arrêté en cours, puis trois fragments laissés par l'arrêt de la montre
    const stopped = [...WARM, ...efforts(2), lap(240, 70, 168), lap(40, 14, 172), lap(0, 3, 170), lap(9, 25, 160)]
    const r = comparePlan({ steps: PLAN }, run(stopped))!
    expect(r).toMatchObject({ doneReps: 2, plannedReps: 4 })
    const p = lapProfile(stopped, r.steps)
    const partial = p.bars.filter((b) => b.state === 'partial')
    expect(partial).toHaveLength(1)
    expect(partial[0]).toMatchObject({ label: 'Effort 3', m: 289, sec: 112, part: null })
    // Le temps couru reste la somme de tous les tours
    expect(p.ran).toBe(stopped.reduce((s, l) => s + l.sec, 0))
    expect(lapDetail(partial[0]!)).toMatch(/^Effort 3, arrêté en cours · 289 m · 1:52/)
  })

  it('sans séance reliée : un fragment rejoint le tour d’avant, un tour court normal reste', () => {
    const p = lapProfile([lap(1000, 400), lap(6, 4), lap(1000, 395), lap(60, 15)])
    expect(p.bars.map((b) => [b.m, b.sec])).toEqual([[1006, 404], [1000, 395], [60, 15]])
  })

  it('un fragment en tête d’étape rejoint le tour suivant de la même étape', () => {
    // Bouton pressé juste après le début d'un effort en temps : 4 s puis 176 s
    const plan: PlanStep[] = [st('warmup', 600), st('interval', 180), st('cooldown', 300)]
    const laps = [...WARM, lap(9, 4, 150), lap(520, 176, 172), lap(700, 300, 140)]
    const r = comparePlan({ steps: plan, durationSec: 1080 }, run(laps))!
    const p = lapProfile(laps, r.steps)
    const effort = p.bars.filter((b) => b.kind === 'interval')
    expect(effort).toHaveLength(1)
    expect(effort[0]).toMatchObject({ m: 529, sec: 180 })
  })

  it('pas d’allure affichée pour un tour presque à l’arrêt', () => {
    const p = lapProfile([lap(1000, 400), lap(40, 60, 120)])
    expect(lapDetail(p.bars[1]!)).not.toMatch(/\/km/)
    expect(lapDetail(p.bars[0]!)).toMatch(/6:40 \/km/)
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

describe('lapLegend', () => {
  it('séance reliée : les natures d’étapes courues, puis ce qui est entamé ou pas fait', () => {
    const keys = lapLegend(lapProfile(laps3, result3.steps)).map((l) => l.key)
    expect(keys).toContain('calm')
    expect(keys).toContain('interval')
    expect(keys).toContain('recovery')
    expect(keys[keys.length - 1]).toBe('missed')
    expect(lapLegend(lapProfile(laps3, result3.steps)).find((l) => l.key === 'calm')!.label).toBe('Échauffement')
  })
  it('sans séance reliée : rien à expliquer (une seule teinte)', () => {
    expect(lapLegend(lapProfile([lap(1000, 400), lap(1000, 380)]))).toEqual([])
  })
})

describe('shareChart : le cadre de l’image à partager n’est jamais vide', () => {
  it('sur tapis avec des tours : une barre par tour, le cardio par-dessus', () => {
    const laps = [lap(1000, 400, 130), lap(1000, 340, 150), lap(1000, 350, 158), lap(1000, 360, 160), lap(1200, 351, 170)]
    const c = shareChart({ laps, stream: streamFromLaps(laps, 7), splits: [400, 340, 350, 360, 300], distanceKm: 5.2, durationSec: 1801 })!
    expect(c.kind).toBe('laps')
    expect(c.bars).toHaveLength(5)
    expect(c.linked).toBe(false)
    // Les barres couvrent tout l'axe du temps, dans l'ordre
    expect(c.bars[0]!.x).toBe(0)
    expect(c.bars.reduce((a, b) => a + b.w, 0)).toBeCloseTo(1)
    // Le tour le plus rapide est le plus haut, le plus lent le plus bas
    expect(c.bars[4]!.level).toBe(1)
    expect(c.bars[0]!.level).toBeCloseTo(0.2)
    expect(c.hr!.length).toBeGreaterThan(20)
    for (const [x, y] of c.hr!) {
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThanOrEqual(1)
      expect(y).toBeGreaterThanOrEqual(0)
      expect(y).toBeLessThanOrEqual(1)
    }
    expect(c.legend).toEqual([{ key: 'hr', label: 'Cardio' }])
    expect(c.hint).toBe('Plus haut = plus rapide')
    expect(c.ticks.map((t) => t.label)).toEqual(['0', '10 min', '20 min'])
  })
  it('séance reliée : étapes colorées, celles pas faites en fin d’axe, et la légende qui va avec', () => {
    const c = shareChart({ laps: laps3, steps: result3.steps })!
    expect(c.kind).toBe('laps')
    expect(c.linked).toBe(true)
    expect(c.bars.some((b) => b.state === 'missed')).toBe(true)
    expect(c.bars.filter((b) => b.kind === 'interval' && b.state === 'done')).toHaveLength(3)
    expect(c.hr).toBeNull()
    expect(c.legend.map((l) => l.key)).toEqual(['calm', 'interval', 'recovery', 'missed'])
    const last = c.bars[c.bars.length - 1]!
    expect(last.x + last.w).toBeCloseTo(1)
  })
  it('sans tours : une barre par kilomètre, plus le reste de la course', () => {
    const c = shareChart({ laps: [lap(5200, 1801)], splits: [370, 350, 345, 340, 330], distanceKm: 5.2, durationSec: 1801 })!
    expect(c.kind).toBe('splits')
    expect(c.bars).toHaveLength(6)
    expect(c.bars[5]!.w).toBeCloseTo(66 / 1801)
    expect(c.hint).toBe('Une barre par kilomètre · plus haut = plus rapide')
    // Un reste trop court ne fait pas de barre
    expect(shareChart({ splits: [370, 350], distanceKm: 2.02, durationSec: 728 })!.bars).toHaveLength(2)
  })
  it('ni tours ni kilomètres : la courbe de cardio seule, si elle existe', () => {
    const c = shareChart({ laps: [lap(900, 400)], splits: [], stream: { t: [0, 100, 200, 300, 400], hr: [110, 130, 140, 145, 150], v: null, d: null } })!
    expect(c.kind).toBe('curve')
    expect(c.bars).toEqual([])
    expect(c.hr).toHaveLength(5)
    expect(c.hr![4]![0]).toBe(1)
    expect(c.hint).toBeNull()
  })
  it('rien à dessiner : null (l’image se passe de cadre), et jamais d’erreur sur des données abîmées', () => {
    expect(shareChart({})).toBeNull()
    expect(shareChart({ laps: [lap(900, 400)], splits: [400], distanceKm: 0.9, durationSec: 400 })).toBeNull()
    expect(shareChart({ laps: null, steps: null, stream: { t: [], hr: null, v: null, d: null }, splits: null })).toBeNull()
    expect(shareChart({ laps: [{ m: Number.NaN, sec: 0 } as unknown as Lap], splits: [Number.NaN, 0] as number[], stream: { t: [0, 1], hr: [0, 0], v: null, d: null } })).toBeNull()
  })
  it('en démo : une séance sur tapis donne toujours un graphique', () => {
    const demo = buildDemo('2026-11-18')
    for (const a of demo.activities.filter((x) => x.indoor)) {
      const c = shareChart({ laps: a.laps, splits: a.splits, distanceKm: a.distanceKm, durationSec: a.durationSec })
      expect(c, a.id).not.toBeNull()
      expect(c!.bars.length, a.id).toBeGreaterThan(1)
    }
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
