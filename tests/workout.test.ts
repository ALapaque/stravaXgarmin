import { describe, expect, it } from 'vitest'
import { flattenSteps, parseWorkoutTitle, stepsSummary, type PlanStep } from '../shared/utils/workout'

const rep = (reps: number, ...children: PlanStep[]): PlanStep => ({ kind: 'repeat', sec: null, m: null, reps, children })
const st = (kind: PlanStep['kind'], sec: number | null, m: number | null = null): PlanStep => ({ kind, sec, m })

describe('flattenSteps', () => {
  it('répétitions dépliées, imbriquées comprises', () => {
    const steps = [st('warmup', 600), rep(2, rep(2, st('interval', null, 200), st('recovery', 60)), st('rest', 180)), st('cooldown', 300)]
    const flat = flattenSteps(steps)
    expect(flat.map((s) => s.kind)).toEqual([
      'warmup', 'interval', 'recovery', 'interval', 'recovery', 'rest', 'interval', 'recovery', 'interval', 'recovery', 'rest', 'cooldown',
    ])
  })
  it('plafond', () => {
    expect(flattenSteps([rep(500, st('interval', 30), st('recovery', 30))], 200)).toHaveLength(200)
    expect(flattenSteps(undefined)).toEqual([])
  })
})

describe('stepsSummary', () => {
  it.each([
    [[rep(5, st('interval', null, 400), st('recovery', null, 200))], '5 × 400 m, récup 200 m'],
    [[st('other', 2400)], '40 min'],
    [[st('warmup', 1200), rep(6, st('interval', 180), st('recovery', 120)), st('cooldown', 600)], '20 min + 6 × 3 min, récup 2 min + 10 min'],
    [[rep(10, st('interval', 30), st('recovery', 30))], '10 × 30 s, récup 30 s'],
    [[st('other', 4800)], '1 h 20'],
    [[st('warmup', null)], 'jusqu’au tour'],
  ])('%#', (steps, text) => {
    expect(stepsSummary(steps as PlanStep[])).toBe(text)
  })
})

/** Étapes dépliées d'un titre, en texte court pour comparer facilement. */
const flat = (title: string) => {
  const r = parseWorkoutTitle(title)
  return r ? flattenSteps(r.steps) : null
}

describe('parseWorkoutTitle', () => {
  it.each(['5x400m(R=200m)', '5 x 400 m (r=200m)', '5×400m R=200m'])('« %s » : 5 × (400 m + 200 m)', (title) => {
    const r = parseWorkoutTitle(title)!
    expect(r.hint).toBe('interval')
    expect(stepsSummary(r.steps)).toBe('5 × 400 m, récup 200 m')
    expect(flat(title)).toHaveLength(10)
  })

  it.each([
    ['8x400m (R=1’)', 8, { m: 400 }, { sec: 60 }],
    ["6×800m R=2'", 6, { m: 800 }, { sec: 120 }],
    ["10x300 r1'15", 10, { m: 300 }, { sec: 75 }],
    ['6x30/30', 6, { sec: 30 }, { sec: 30 }],
    ['10x30"/30"', 10, { sec: 30 }, { sec: 30 }],
  ])('« %s »', (title, reps, effort, rest) => {
    const f = flat(title)!
    expect(f.filter((s) => s.kind === 'interval')).toHaveLength(reps)
    expect(f[0]).toMatchObject({ kind: 'interval', ...effort })
    expect(f[1]).toMatchObject({ kind: 'recovery', ...rest })
  })

  it('sans unité : ≥ 100 → mètres, ≤ 20 → minutes, entre les deux → secondes', () => {
    expect(flat('4x4 HR')).toEqual(Array.from({ length: 4 }, () => ({ kind: 'interval', sec: 240, m: null })))
    expect(flat('3x10')![0]).toEqual({ kind: 'interval', sec: 600, m: null })
    expect(flat('8x45')![0]).toEqual({ kind: 'interval', sec: 45, m: null })
    expect(flat('6x200')![0]).toEqual({ kind: 'interval', sec: null, m: 200 })
  })

  it.each([
    ['Footing 40’', 2400, 'easy'],
    ['Footing 40 min', 2400, 'easy'],
    ['45’ Easy Run', 2700, 'easy'],
    ['EF45 Z2', 2700, 'easy'],
    ["EF 45'", 2700, 'easy'],
    ['55’ Long Run', 3300, 'long'],
    ['Sortie longue 1h20', 4800, 'long'],
    ['SL 1h30', 5400, 'long'],
    ['1h15 SL', 4500, 'long'],
    ['Footing 50’ - 3’ rapide', 3000, 'easy'],
    ['Tempo 20’', 1200, 'tempo'],
  ])('« %s » : une étape de %i s, %s', (title, sec, hint) => {
    const r = parseWorkoutTitle(title)!
    expect(r.hint).toBe(hint)
    expect(flattenSteps(r.steps)).toEqual([expect.objectContaining({ sec, m: null })])
  })

  it('Seuil 3x8’ : tempo en répétitions', () => {
    const r = parseWorkoutTitle('Seuil 3x8’')!
    expect(r.hint).toBe('tempo')
    expect(flattenSteps(r.steps)).toEqual(Array.from({ length: 3 }, () => ({ kind: 'interval', sec: 480, m: null })))
  })

  it('aucune durée : indice seul, ou null', () => {
    expect(parseWorkoutTitle('Footing pyramidal')).toEqual({ steps: [], hint: 'easy' })
    expect(parseWorkoutTitle('Test VMA')).toEqual({ steps: [], hint: 'interval' })
    expect(parseWorkoutTitle('Sortie longue')).toEqual({ steps: [], hint: 'long' })
    expect(parseWorkoutTitle('Course à pied en soirée')).toBeNull()
    expect(parseWorkoutTitle('')).toBeNull()
  })
})
