import { describe, expect, it } from 'vitest'
import { classify, habitsOf, matchGarmin, withOverride, type GarminRun, type StravaRun } from '../shared/utils/classify'

// Courses inventées
const run = (o: Partial<StravaRun> = {}): StravaRun => ({
  id: 1,
  name: 'Morning Run',
  start_date: '2026-11-17T17:42:00Z',
  distance: 8000,
  moving_time: 8 * 330,
  total_elevation_gain: 20,
  ...o,
})
const garmin = (o: Partial<GarminRun> = {}): GarminRun => ({ id: 9, name: 'Course', startTimeGMT: '2026-11-17 17:42:00', ...o })
const habits = { pace: 330, km: 8 }

describe('classify', () => {
  it('workout_type 2 → sortie longue', () => {
    expect(classify(run({ workout_type: 2, distance: 6000 }), undefined, habits)).toEqual({ type: 'long', reason: 'marquée sortie longue sur Strava' })
  })

  it.each([
    ['Fractionné piste', 'interval'],
    ['10x400', 'interval'],
    ['6 × 800', 'interval'],
    ['Tempo du jeudi', 'tempo'],
    ['Seuil 3×10', 'interval'],
    ['Allure seuil', 'tempo'],
    ['Footing récup', 'recovery'],
    ['Recup', 'recovery'],
    ['Long run', 'long'],
    ['Sortie longue', 'long'],
  ])('d’après le nom : « %s » → %s', (name, type) => {
    const r = classify(run({ name }), undefined, habits)
    expect(r.type).toBe(type)
    expect(r.reason).toBe('d’après son nom')
  })

  it.each([
    ['RECOVERY', 'recovery'],
    ['AEROBIC_BASE', 'easy'],
    ['TEMPO', 'tempo'],
    ['LACTATE_THRESHOLD', 'tempo'],
    ['VO2MAX', 'interval'],
    ['ANAEROBIC_CAPACITY', 'interval'],
    ['SPRINT', 'interval'],
  ])('effet Garmin %s → %s', (effect, type) => {
    expect(classify(run(), garmin({ effect }), habits)).toEqual({ type, reason: 'selon ta montre' })
  })

  it('effet Garmin sur une course longue → sortie longue', () => {
    expect(classify(run({ distance: 16000, moving_time: 16 * 330 }), garmin({ effect: 'AEROBIC_BASE' }), habits).type).toBe('long')
    expect(classify(run({ distance: 16000, moving_time: 16 * 300 }), garmin({ effect: 'TEMPO' }), habits).type).toBe('long')
  })

  it('le nom passe avant l’effet Garmin', () => {
    expect(classify(run({ name: 'Footing récup' }), garmin({ effect: 'VO2MAX' }), habits).type).toBe('recovery')
  })

  it('workout_type 3 : fractionné si plus rapide que d’habitude, sinon tempo', () => {
    expect(classify(run({ workout_type: 3, moving_time: 8 * 310 }), undefined, habits)).toEqual({ type: 'interval', reason: 'marquée entraînement sur Strava' })
    expect(classify(run({ workout_type: 3, moving_time: 8 * 325 }), undefined, habits)).toEqual({ type: 'tempo', reason: 'marquée entraînement sur Strava' })
  })

  it('repli sur l’allure et la distance habituelles', () => {
    expect(classify(run({ distance: 14000, moving_time: 14 * 330 }), undefined, habits)).toEqual({ type: 'long', reason: 'plus longue que d’habitude' })
    expect(classify(run({ moving_time: 8 * 300 }), undefined, habits)).toEqual({ type: 'tempo', reason: 'selon ton allure habituelle' })
    expect(classify(run({ moving_time: 8 * 360 }), undefined, habits)).toEqual({ type: 'recovery', reason: 'selon ton allure habituelle' })
    expect(classify(run(), undefined, habits)).toEqual({ type: 'easy', reason: 'selon ton allure habituelle' })
  })
})

describe('habitsOf', () => {
  it('moins de 4 courses utilisables → valeurs par défaut', () => {
    expect(habitsOf([])).toEqual({ pace: 330, km: 8 })
    expect(habitsOf([run(), run(), run(), run({ distance: 1500 })])).toEqual({ pace: 330, km: 8 })
  })

  it('médianes de l’allure et de la distance', () => {
    const runs = [5000, 6000, 10000, 12000].map((d) => run({ distance: d, moving_time: (d / 1000) * 300 }))
    expect(habitsOf(runs)).toEqual({ pace: 300, km: 10 })
  })
})

describe('matchGarmin', () => {
  const s = run({ start_date: '2026-11-17T17:42:00Z' })

  it('à 2 minutes d’écart : trouvée', () => {
    expect(matchGarmin(s, [garmin({ id: 1, startTimeGMT: '2026-11-17 17:44:00' })])?.id).toBe(1)
    expect(matchGarmin(s, [garmin({ id: 2, startTimeGMT: '2026-11-17 17:40:00' })])?.id).toBe(2)
  })

  it('à 5 minutes d’écart : pas trouvée', () => {
    expect(matchGarmin(s, [garmin({ startTimeGMT: '2026-11-17 17:47:00' })])).toBeUndefined()
  })
})

describe('compétitions', () => {
  it('marquée compétition sur Strava (workout_type 1), avant toute autre règle', () => {
    expect(classify(run({ workout_type: 1, name: '10 km des Étangs' }), garmin({ effect: 'VO2MAX' }), habits)).toEqual({ type: 'race', reason: 'marquée compétition sur Strava' })
  })
  it('titre étiqueté [RACE]', () => {
    expect(classify(run({ name: '[RACE] - Semi des Collines' }), undefined, habits)).toEqual({ type: 'race', reason: 'd’après son nom' })
    // « race » au milieu d'un nom ne suffit pas
    expect(classify(run({ name: 'Footing après la race' }), undefined, habits).type).not.toBe('race')
  })
})

describe('withOverride', () => {
  const auto = { type: 'easy' as const, reason: 'selon ton allure habituelle' }
  it('le choix manuel gagne ; absent ou inconnu : type deviné', () => {
    expect(withOverride(auto, 'race')).toEqual({ type: 'race', reason: 'choisi par toi' })
    expect(withOverride(auto, null)).toEqual(auto)
    expect(withOverride(auto, 'sprint' as never)).toEqual(auto)
  })
})
