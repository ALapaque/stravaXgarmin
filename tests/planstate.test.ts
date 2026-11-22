import { describe, expect, it } from 'vitest'
import type { PlanSession } from '../shared/utils/model'
import { knownIds, mergePlan, upgradePlanSession, upgradePlanState } from '../shared/utils/planstate'

// Séances INVENTÉES
const TODAY = '2026-11-20'
const full = (id: string, date: string, title = `Séance ${id}`): PlanSession => ({
  ...upgradePlanSession({ id, date, title }),
  steps: [{ kind: 'other', sec: 2400, m: null }],
  workoutId: 10,
})

describe('upgradePlanState (plan gardé par la version précédente)', () => {
  it('séances complétées, et date de lecture effacée pour relire les étapes tout de suite', () => {
    const old = { at: '2026-11-20T08:00:00Z', list: [{ id: '1', date: '2026-11-21', title: 'Footing', description: null, provider: 'Kiprun Pacer', durationSec: 2400, distanceM: null, lines: [], blocks: [] }] }
    const r = upgradePlanState(old)!
    expect(r.at).toBe('')
    expect(r.list[0]).toMatchObject({ id: '1', steps: [], workoutId: null, provider: 'Kiprun Pacer', durationSec: 2400 })
  })
  it('état à jour : date gardée ; état abîmé : null ou liste vide', () => {
    expect(upgradePlanState({ at: 'x', list: [full('1', '2026-11-21')] })!.at).toBe('x')
    expect(upgradePlanState(null)).toBeNull()
    expect(upgradePlanState({ at: 3, list: 'x' })).toEqual({ at: '', list: [] })
  })
})

describe('mergePlan', () => {
  it('séance connue : détail gardé ; disparue de la fenêtre lue : retirée ; ancienne : gardée jusqu’à 60 jours', () => {
    const stored = [full('a', '2026-11-18'), full('b', '2026-11-16'), full('old', '2026-10-01'), full('tooOld', '2026-09-01'), full('f', '2026-11-25')]
    const fresh = [
      { id: 'a', date: '2026-11-18', title: 'Séance a (renommée)', workoutId: 10, known: true },
      { id: 'n', date: '2026-11-22', title: 'Tempo 20’', workoutId: 11, steps: [], lines: [], blocks: [] },
    ]
    const r = mergePlan(stored, fresh, TODAY)
    expect(r.map((s) => s.id)).toEqual(['old', 'a', 'n'])
    expect(r[1]).toMatchObject({ title: 'Séance a (renommée)', steps: [{ kind: 'other', sec: 2400, m: null }] })
  })
  it('connue d’après le serveur mais absente d’ici : relue la prochaine fois', () => {
    const r = mergePlan([], [{ id: 'z', date: '2026-11-10', title: 'Footing', workoutId: null, known: true }], TODAY)
    expect(r[0]).toMatchObject({ id: 'z', steps: [], pending: true })
    expect(knownIds(r, TODAY)).toEqual([])
  })
  it('doublon (même jour, même titre) gardé une fois', () => {
    const r = mergePlan([], [full('1', '2026-11-22', 'Footing'), full('2', '2026-11-22', 'Footing')], TODAY)
    expect(r).toHaveLength(1)
  })
})

describe('knownIds', () => {
  it('seulement les séances passées déjà lues', () => {
    const list = [full('p', '2026-11-18'), { ...full('q', '2026-11-17'), pending: true }, full('t', TODAY), full('f', '2026-11-25')]
    expect(knownIds(list, TODAY)).toEqual(['p'])
  })
})
