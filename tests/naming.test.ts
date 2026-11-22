import { describe, expect, it } from 'vitest'
import { DEFAULT_TEMPLATES, decideAutoName, isGenericName, renderTemplate, type NamingInput } from '../shared/utils/naming'

// Course inventée : mardi 17 novembre 2026, 18 h 42 à Bruxelles
const run: NamingInput = {
  type: 'long',
  distanceKm: 12.4,
  durationSec: 3912,
  place: 'chemins',
  startedAt: '2026-11-17T17:42:00Z',
  weather: { tempC: 9, sky: 'pluie fine' },
}

describe('renderTemplate', () => {
  it('modèle par défaut, nombres au format belge', () => {
    expect(renderTemplate(run, DEFAULT_TEMPLATES.long)).toBe('Sortie longue 12,4 km · Chemins')
    expect(renderTemplate(run, DEFAULT_TEMPLATES.tempo)).toBe('Tempo 12,4 km à 5:15 /km')
  })

  it('lieu vide : le « · » final disparaît', () => {
    expect(renderTemplate({ ...run, place: '' }, DEFAULT_TEMPLATES.long)).toBe('Sortie longue 12,4 km')
    expect(renderTemplate({ ...run, place: '' }, '{lieu} · Footing')).toBe('Footing')
  })

  it('jeton inconnu laissé tel quel', () => {
    expect(renderTemplate(run, 'Course {inconnu} {distance}')).toBe('Course {inconnu} 12,4')
  })

  it('jetons insensibles à la casse', () => {
    expect(renderTemplate(run, '{DISTANCE} km {Type} {MÉTÉO}')).toBe('12,4 km Sortie longue 9 °C, pluie fine')
  })

  it('{moment} et {jour} calculés à Bruxelles', () => {
    expect(renderTemplate(run, '{jour} {moment}')).toBe('Mardi soir')
    // 10 h 30 UTC = 11 h 30 à Bruxelles : midi, pas matin
    expect(renderTemplate({ ...run, startedAt: '2026-11-17T10:30:00Z' }, '{moment}')).toBe('midi')
    // 23 h 30 UTC = mercredi 0 h 30 à Bruxelles
    expect(renderTemplate({ ...run, startedAt: '2026-11-17T23:30:00Z' }, '{jour} {moment}')).toBe('Mercredi matin')
  })

  it('sans météo, durée', () => {
    expect(renderTemplate({ ...run, weather: undefined }, '{durée} {météo}')).toBe('1:05:12')
  })
})

describe('isGenericName (noms par défaut déjà reconnus)', () => {
  it.each(['Morning Run', 'Lunch Run', 'Evening Run', 'Course', 'Course à pied', 'Course du matin', 'Footing du soir'])('%s', (n) => {
    expect(isGenericName(n)).toBe(true)
  })
  it.each(['Sortie longue', 'Footing récup', 'Tempo 5 km'])('%s n’est pas générique', (n) => {
    expect(isGenericName(n)).toBe(false)
  })
})

describe('decideAutoName : toute la matrice', () => {
  const GENERIC = 'Morning Run'
  const WRITTEN = 'Sortie au bois avec le club'
  const GARMIN_GOOD = 'Fractionné 10×400'
  const RULE = 'Fractionné Piste · 5:19 /km'

  // [nom Strava générique, nom Garmin parlant, « écraser », règle non vide] → résultat attendu
  const cases: [boolean, boolean, boolean, boolean, { target: string; source: 'garmin' | 'regle' } | null][] = [
    [true, true, false, false, { target: GARMIN_GOOD, source: 'garmin' }],
    [true, true, false, true, { target: GARMIN_GOOD, source: 'garmin' }],
    [true, true, true, false, { target: GARMIN_GOOD, source: 'garmin' }],
    [true, true, true, true, { target: GARMIN_GOOD, source: 'garmin' }],
    [true, false, false, false, null],
    [true, false, false, true, { target: RULE, source: 'regle' }],
    [true, false, true, false, null],
    [true, false, true, true, { target: RULE, source: 'regle' }],
    [false, true, false, false, null],
    [false, true, false, true, null],
    [false, true, true, false, { target: GARMIN_GOOD, source: 'garmin' }],
    [false, true, true, true, { target: GARMIN_GOOD, source: 'garmin' }],
    [false, false, false, false, null],
    [false, false, false, true, null],
    [false, false, true, false, null],
    [false, false, true, true, null],
  ]

  it.each(cases)('Strava générique %s · Garmin parlant %s · écraser %s · règle %s', (generic, garminGood, overwrite, rule, expected) => {
    expect(
      decideAutoName({
        stravaName: generic ? GENERIC : WRITTEN,
        garminName: garminGood ? GARMIN_GOOD : 'Morning Run',
        hasGarmin: true,
        ruleTitle: rule ? RULE : '',
        overwriteEdited: overwrite,
      }),
    ).toEqual(expected)
  })

  it('sans activité Garmin reliée, le nom Garmin ne compte pas', () => {
    expect(decideAutoName({ stravaName: GENERIC, garminName: GARMIN_GOOD, hasGarmin: false, ruleTitle: RULE, overwriteEdited: false }))
      .toEqual({ target: RULE, source: 'regle' })
    expect(decideAutoName({ stravaName: GENERIC, garminName: GARMIN_GOOD, hasGarmin: false, ruleTitle: '', overwriteEdited: true })).toBeNull()
  })

  it('rien à faire quand la cible est déjà le nom actuel', () => {
    expect(decideAutoName({ stravaName: GARMIN_GOOD, garminName: GARMIN_GOOD, hasGarmin: true, ruleTitle: RULE, overwriteEdited: true })).toBeNull()
    expect(decideAutoName({ stravaName: 'Course', garminName: 'Course', hasGarmin: true, ruleTitle: 'Course', overwriteEdited: false })).toBeNull()
  })
})
