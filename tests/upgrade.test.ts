import { describe, expect, it } from 'vitest'
import { comparePlan } from '../shared/utils/compliance'
import { needsDebrief } from '../shared/utils/debrief'
import { matchPlan } from '../shared/utils/planmatch'
import { displayTitle } from '../shared/utils/titles'
import { upgradeActivities, upgradeActivity } from '../shared/utils/upgrade'

/* État INVENTÉ laissé par la version précédente : aucun des nouveaux champs. */
const OLD_RUN = {
  id: 's101',
  stravaId: 101,
  type: 'interval',
  startedAt: '2026-11-17T23:30:00Z', // 00 h 30 à Bruxelles : le jour local est le lendemain
  place: 'Bruxelles',
  distanceKm: 8,
  durationSec: 2550,
  avgHr: 160,
  elevationM: 4,
  splits: [312, 330],
  bestEfforts: { '5k': 1590 },
  garminName: 'Tapis de course - 8x400m (R=1’)',
  stravaName: 'Course à pied de nuit',
}

describe('upgradeActivity', () => {
  it('valeurs par défaut pour les champs absents, le reste gardé', () => {
    const a = upgradeActivity(OLD_RUN)
    expect(a).toMatchObject({ ...OLD_RUN, indoor: false, sport: 'Run', localDate: '2026-11-18', elapsedSec: 2550 })
    expect(a.laps).toBeUndefined()
  })

  it('séance sur tapis gardée : le lieu devient « tapis »', () => {
    expect(upgradeActivity({ ...OLD_RUN, indoor: true }).place).toBe('tapis')
  })

  it('valeurs abîmées : remplacées, jamais d’erreur', () => {
    const a = upgradeActivity({ id: 'x', type: 'sprint', distanceKm: 'NaN', splits: [1, 'a'], laps: [null, { m: 400, sec: 90 }], sport: 'Swim' })
    expect(a).toMatchObject({ type: 'easy', distanceKm: 0, splits: [1], sport: 'Run', laps: [{ m: 400, sec: 90, elapsedSec: 90, hr: null, maxHr: null }] })
    expect(upgradeActivities('pas une liste')).toEqual([])
    expect(upgradeActivities([null, 3, OLD_RUN])).toHaveLength(1)
  })

  it('les fonctions d’affichage acceptent l’état mis à niveau', () => {
    const a = upgradeActivity(OLD_RUN)
    expect(displayTitle(a).title).toBe('8x400m (R=1’)')
    expect(() => matchPlan([{ id: a.id, localDate: a.localDate, names: [a.stravaName, a.garminName] }], [], {}, '2026-11-20')).not.toThrow()
    // Pas de tours, étapes mêlées (efforts en distance, récups en temps), pas de durée prévue : rien de fiable
    expect(comparePlan({ title: '8x400m (R=1’)' }, { durationSec: a.durationSec, distanceM: a.distanceKm * 1000, laps: a.laps })).toBeNull()
    expect(comparePlan({ title: 'Footing 40’' }, { durationSec: a.durationSec, distanceM: 8000, laps: a.laps })).toMatchObject({ basis: 'duration' })
    expect(needsDebrief(a, {}, { since: '2026-11-10T00:00:00Z', convention: true })).toBe(true)
  })
})
