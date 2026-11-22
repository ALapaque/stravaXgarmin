import { describe, expect, it } from 'vitest'
import { alignPlan, comparePlan, OUTCOME_DONE, OUTCOME_SHORT, type Lap } from '../shared/utils/compliance'
import { flattenSteps, type PlanStep } from '../shared/utils/workout'

/* Petites fonctions d'aide : tours INVENTÉS, construits comme une montre les découpe. */

const lap = (m: number, sec: number, hr: number | null = 150): Lap => ({ m, sec, elapsedSec: sec, hr, maxHr: hr === null ? null : hr + 8 })

/** Une étape longue à allure régulière, découpée par le tour automatique de 1 km (plus le reste). */
function autoLaps(m: number, sec: number, hr = 140): Lap[] {
  const out: Lap[] = []
  const pace = sec / m
  let left = m
  while (left > 1000.5) {
    out.push(lap(1000, Math.round(1000 * pace), hr))
    left -= 1000
  }
  out.push(lap(Math.round(left), sec - out.reduce((s, l) => s + l.sec, 0), hr))
  return out
}

const st = (kind: PlanStep['kind'], sec: number | null, m: number | null = null): PlanStep => ({ kind, sec, m })
const rep = (reps: number, ...children: PlanStep[]): PlanStep => ({ kind: 'repeat', sec: null, m: null, reps, children })
const total = (laps: Lap[]) => ({
  durationSec: laps.reduce((s, l) => s + l.sec, 0),
  distanceM: laps.reduce((s, l) => s + l.m, 0),
  laps,
})

// Échauffement 15 min (2,5 km) + 5 × (400 m / 200 m) + retour au calme 10 min
const PLAN_400: PlanStep[] = [st('warmup', 900), rep(5, st('interval', null, 400), st('recovery', null, 200)), st('cooldown', 600)]
const WARMUP = autoLaps(2500, 900)
const efforts400 = (n: number) => Array.from({ length: n }, () => [lap(400, 110, 172), lap(200, 80, 150)]).flat()

describe('alignPlan / comparePlan : efforts en distance', () => {
  it('séance complète : 5 sur 5, faite, alignée', () => {
    const laps = [...WARMUP, ...efforts400(5), ...autoLaps(1540, 600, 135)]
    const al = alignPlan(flattenSteps(PLAN_400), laps)
    expect(al.aligned).toBe(true)
    expect(al.steps.every((s) => s.done && s.exact)).toBe(true)
    expect(al.steps[1]!.actual).toEqual({ sec: 110, m: 400, hr: 172 })
    const r = comparePlan({ steps: PLAN_400, durationSec: 2500, distanceM: null, title: '5x400m(R=200m)' }, total(laps))!
    expect(r).toMatchObject({ ratio: 1, outcome: 'done', basis: 'reps', plannedReps: 5, doneReps: 5, summary: '5 efforts sur 5' })
  })

  it('arrêtée pendant le 3ᵉ effort, fragments de fin : 2 sur 5, ratée', () => {
    const laps = [...WARMUP, ...efforts400(2), lap(250, 70, 170), lap(5, 3, 160), lap(3, 2, 158)]
    const r = comparePlan({ steps: PLAN_400, durationSec: 2500, distanceM: null, title: '' }, total(laps))!
    expect(r).toMatchObject({ outcome: 'failed', doneReps: 2, plannedReps: 5, summary: '2 efforts sur 5' })
    const third = r.steps[5]!
    expect(third.kind).toBe('interval')
    expect(third.done).toBe(false)
    expect(third.fraction).toBeCloseTo(258 / 400, 3)
    expect(r.steps.slice(6).every((s) => !s.done && s.fraction === 0 && s.actual === null)).toBe(true)
  })

  it('6 × 1000 m, échauffement lui aussi découpé en tours de 1000 m : ces tours ne sont pas des efforts', () => {
    const plan = [st('warmup', 900), rep(6, st('interval', null, 1000), st('recovery', 120)), st('cooldown', 600)]
    const efforts = Array.from({ length: 6 }, () => [lap(1000, 240, 175), lap(300, 120, 145)]).flat()
    const laps = [...WARMUP, ...efforts, ...autoLaps(1600, 600)]
    const r = comparePlan({ steps: plan, durationSec: null, distanceM: null, title: '' }, total(laps))!
    expect(r.doneReps).toBe(6)
    const done = r.steps.filter((s) => s.kind === 'interval')
    expect(done.every((s) => s.exact && s.actual?.sec === 240 && s.actual.m === 1000 && s.actual.hr === 175)).toBe(true)
    // Le même plan connu par son seul titre : le départ est trouvé après l'échauffement
    const byTitle = comparePlan({ steps: [], durationSec: null, distanceM: null, title: "6x1000m (R=2')" }, total(laps))!
    expect(byTitle.doneReps).toBe(6)
    expect(byTitle.steps[0]!.actual).toEqual({ sec: 240, m: 1000, hr: 175 })
  })
})

describe('alignPlan / comparePlan : efforts en temps', () => {
  it('4 × 4 min (récup 3 min), petit tour parasite de 4 s au début d’un effort : 4 sur 4', () => {
    const plan = [st('warmup', 600), rep(4, st('interval', 240), st('recovery', 180)), st('cooldown', 300)]
    const laps = [
      ...autoLaps(1900, 600),
      lap(15, 4, 160), lap(785, 236, 170), lap(450, 180, 140), // parasite puis la fin du 1er effort
      lap(800, 240, 171), lap(450, 180, 141),
      lap(800, 240, 172), lap(450, 180, 142),
      lap(800, 240, 173), lap(450, 180, 143),
      lap(800, 300, 135),
    ]
    const r = comparePlan({ steps: plan, durationSec: 2580, distanceM: null, title: '4x4 HR' }, total(laps))!
    expect(r).toMatchObject({ basis: 'reps', doneReps: 4, plannedReps: 4, outcome: 'done' })
    // FC du 1er effort pondérée par le temps : (4 × 160 + 236 × 170) / 240
    expect(r.steps[1]!.actual).toEqual({ sec: 240, m: 800, hr: Math.round((4 * 160 + 236 * 170) / 240) })
  })
})

describe('comparePlan : durée et distance', () => {
  const footing = (min: number) => ({ steps: [st('other', min * 60)], durationSec: min * 60, distanceM: null, title: `Footing ${min}’` })

  it('footing 40 min, 40 min faites (tours de 1 km + reste) : faite par la durée', () => {
    const laps = autoLaps(6150, 2400)
    const r = comparePlan(footing(40), total(laps))!
    expect(r).toMatchObject({ basis: 'duration', ratio: 1, outcome: 'done', summary: '40 min sur 40' })
  })

  it('31 min sur 55 : écourtée ; 12 min sur 45 : ratée', () => {
    expect(comparePlan(footing(55), total(autoLaps(4800, 31 * 60)))).toMatchObject({ outcome: 'short', summary: '31 min sur 55' })
    expect(comparePlan(footing(45), total(autoLaps(1900, 12 * 60)))).toMatchObject({ outcome: 'failed', summary: '12 min sur 45' })
  })

  it('heure passée : « 1 h 20 sur 1 h 30 »', () => {
    expect(comparePlan(footing(90), total(autoLaps(13000, 80 * 60)))!.summary).toBe('1 h 20 sur 1 h 30')
  })

  it('séance décrite en distance : « 6,2 km sur 10 »', () => {
    const r = comparePlan({ steps: [st('other', null, 10000)], durationSec: 3600, distanceM: 10000, title: '' }, total(autoLaps(6200, 2100)))!
    expect(r).toMatchObject({ basis: 'distance', outcome: 'short', summary: '6,2 km sur 10' })
  })

  it('séance faite sans guidage (seulement des tours de 1 km) pour un plan en temps : faite par la durée, pas alignée', () => {
    const plan = [st('warmup', 600), st('other', 1200), st('cooldown', 600)]
    const laps = autoLaps(6860, 2400) // 5:50 /km : aucune frontière ne tombe sur la fin de l'échauffement
    expect(alignPlan(flattenSteps(plan), laps).aligned).toBe(false)
    const r = comparePlan({ steps: plan, durationSec: null, distanceM: null, title: '' }, total(laps))!
    expect(r).toMatchObject({ basis: 'duration', outcome: 'done', ratio: 1 })
    expect(r.steps.every((s) => s.done)).toBe(true)
  })

  it('séance connue par son seul titre, tours précédés d’un échauffement inconnu : bon départ trouvé', () => {
    const laps = [lap(1000, 360, 138), lap(1000, 355, 140), lap(700, 250, 142), ...efforts400(5), lap(1000, 380, 135), lap(300, 120, 130)]
    const r = comparePlan({ steps: [], durationSec: null, distanceM: null, title: '5x400m(R=200m)' }, total(laps))!
    expect(r).toMatchObject({ basis: 'reps', doneReps: 5, outcome: 'done' })
    expect(r.steps[0]!.actual).toEqual({ sec: 110, m: 400, hr: 172 })
    expect(alignPlan(flattenSteps([rep(5, st('interval', null, 400), st('recovery', null, 200))]), laps).aligned).toBe(true)
  })

  it('aucun tour : repli sur la durée ; rien de comparable : null', () => {
    const plan = { steps: [rep(4, st('interval', 240), st('recovery', 180))], durationSec: 2700, distanceM: null, title: '' }
    expect(comparePlan(plan, { durationSec: 2700, distanceM: 7000, laps: [] })).toMatchObject({ basis: 'duration', outcome: 'done' })
    expect(comparePlan({ steps: [], durationSec: null, distanceM: null, title: 'Footing pyramidal' }, { durationSec: 2000, distanceM: 5000, laps: [] })).toBeNull()
  })

  it('seuils exportés', () => {
    expect(OUTCOME_DONE).toBe(0.9)
    expect(OUTCOME_SHORT).toBe(0.5)
  })

  it('tours abîmés d’un ancien état : pas d’erreur', () => {
    const bad = [{ m: Number.NaN, sec: -3 }, null, { m: 1000, sec: 300 }] as unknown as Lap[]
    expect(() => comparePlan({ title: '5x400m(R=200m)' }, { durationSec: 300, distanceM: 1000, laps: bad })).not.toThrow()
  })
})
