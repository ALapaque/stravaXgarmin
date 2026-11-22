import { describe, expect, it } from 'vitest'
import { walkGarminSteps } from '../shared/utils/garminWorkout'
import { flattenSteps, stepsSummary } from '../shared/utils/workout'

// Réponse Garmin INVENTÉE, de la forme de « workout-service/workout/{id} »
const step = (key: string, cond: string, value: number | null, extra: Record<string, unknown> = {}) => ({
  type: 'ExecutableStepDTO',
  stepType: { stepTypeKey: key },
  endCondition: { conditionTypeKey: cond },
  endConditionValue: value,
  ...extra,
})

describe('walkGarminSteps', () => {
  it('lignes, profil et étapes dans le même parcours', () => {
    const raw = [
      step('warmup', 'time', 1200),
      {
        type: 'RepeatGroupDTO',
        numberOfIterations: 6,
        workoutSteps: [
          step('interval', 'distance', 800, { targetType: { workoutTargetTypeKey: 'pace.zone' }, targetValueOne: 4.0, targetValueTwo: 4.2 }),
          step('recovery', 'time', 120),
        ],
      },
      step('cooldown', 'lap.button', null),
    ]
    const w = walkGarminSteps(raw)
    expect(w.lines.map((l) => l.kind)).toEqual(['warmup', 'repeat', 'cooldown'])
    expect(w.blocks).toHaveLength(14)
    expect(w.steps[0]).toEqual({ kind: 'warmup', sec: 1200, m: null, target: null })
    expect(w.steps[1]).toMatchObject({ kind: 'repeat', reps: 6 })
    expect(w.steps[1]!.children![0]).toEqual({ kind: 'interval', sec: null, m: 800, target: '3:58–4:10 /km' })
    expect(w.steps[2]).toEqual({ kind: 'cooldown', sec: null, m: null, target: null })
    expect(stepsSummary(w.steps)).toBe('20 min + 6 × 800 m, récup 2 min + jusqu’au tour')
    expect(flattenSteps(w.steps)).toHaveLength(14)
  })

  it('réponse inattendue : rien, sans erreur', () => {
    expect(walkGarminSteps(undefined)).toEqual({ lines: [], blocks: [], steps: [] })
    expect(walkGarminSteps([null, 3, 'x', { stepType: null, endConditionValue: 'abc' }]).steps).toEqual([{ kind: 'other', sec: null, m: null, target: null }])
  })
})
