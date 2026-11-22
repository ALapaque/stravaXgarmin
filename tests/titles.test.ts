import { describe, expect, it } from 'vitest'
import { cleanWatchName, detectConvention, displayTitle, formatTitle, guessSource, normalizeTitle, parseTitle } from '../shared/utils/titles'

// Titres inventés
describe('parseTitle', () => {
  it('étiquettes et titre', () => {
    expect(parseTitle('[FAIL][KIPRUN] - 5x400m(R=200m)')).toEqual({ tags: ['FAIL', 'KIPRUN'], title: '5x400m(R=200m)', tagged: true })
    expect(parseTitle('[KIPRUN] - Footing 40’')).toEqual({ tags: ['KIPRUN'], title: 'Footing 40’', tagged: true })
  })

  it('seul le premier séparateur compte', () => {
    expect(parseTitle('[RACE] - Trail des Sources - 13 km').title).toBe('Trail des Sources - 13 km')
  })

  it('séparateur absent ou collé, étiquettes en majuscules sans espaces', () => {
    expect(parseTitle('[KIPRUN] Footing').title).toBe('Footing')
    expect(parseTitle('[KIPRUN]- Footing').title).toBe('Footing')
    expect(parseTitle('[ kiprun ] [Fail] – Footing')).toEqual({ tags: ['KIPRUN', 'FAIL'], title: 'Footing', tagged: true })
  })

  it('sans étiquette, crochet au milieu, valeurs absentes', () => {
    expect(parseTitle('Footing du soir')).toEqual({ tags: [], title: 'Footing du soir', tagged: false })
    expect(parseTitle('Footing [tapis] du soir')).toEqual({ tags: [], title: 'Footing [tapis] du soir', tagged: false })
    expect(parseTitle(undefined)).toEqual({ tags: [], title: '', tagged: false })
  })
})

describe('formatTitle', () => {
  it('avec source, ratée, sans source', () => {
    expect(formatTitle({ source: 'KIPRUN', title: '5x400m(R=200m)', failed: true })).toBe('[FAIL][KIPRUN] - 5x400m(R=200m)')
    expect(formatTitle({ source: 'kiprun', title: 'Footing 40’' })).toBe('[KIPRUN] - Footing 40’')
    expect(formatTitle({ source: null, title: 'Footing 40’' })).toBe('Footing 40’')
    expect(formatTitle({ source: 'CUSTOM', title: 'Côtes', failed: true, failTag: 'RATE' })).toBe('[RATE][CUSTOM] - Côtes')
  })

  it('un titre déjà étiqueté ne l’est pas deux fois', () => {
    expect(formatTitle({ source: 'KIPRUN', title: '[KIPRUN] - Footing 40’' })).toBe('[KIPRUN] - Footing 40’')
  })

  it('aller-retour avec parseTitle', () => {
    const t = formatTitle({ source: 'KIPRUN', title: 'Seuil 3x8’', failed: true })
    expect(parseTitle(t)).toEqual({ tags: ['FAIL', 'KIPRUN'], title: 'Seuil 3x8’', tagged: true })
  })
})

describe('detectConvention', () => {
  it('3 noms étiquetés au moins, sources par fréquence, FAIL exclu', () => {
    const names = ['[KIPRUN] - Footing', '[FAIL][KIPRUN] - 6x800m', '[CUSTOM] - Côtes', '[KIPRUN] - Tempo 20’', 'Morning Run']
    expect(detectConvention(names)).toEqual({ enabled: true, sources: ['KIPRUN', 'CUSTOM'] })
  })

  it('moins de 3 : pas activée', () => {
    expect(detectConvention(['[KIPRUN] - Footing', 'Morning Run', '[RACE] - 10 km']).enabled).toBe(false)
  })
})

describe('guessSource', () => {
  const known = ['KIPRUN', 'CUSTOM', 'RACE']
  it('compétition d’abord', () => {
    expect(guessSource({ provider: 'Kiprun Pacer', title: 'Footing', isRace: true, known, history: [] })).toBe('RACE')
  })
  it('fournisseur Garmin qui contient une source connue', () => {
    expect(guessSource({ provider: 'Kiprun Pacer', title: 'Footing', known, history: [] })).toBe('KIPRUN')
  })
  it('même titre déjà publié, puis dernière source utilisée, sinon CUSTOM', () => {
    const history = [
      { title: '[CUSTOM] - Côtes', source: 'CUSTOM' },
      { title: '[KIPRUN] - Footing 40’', source: 'KIPRUN' },
    ]
    expect(guessSource({ title: 'footing 40\'', known, history })).toBe('KIPRUN')
    expect(guessSource({ title: 'Autre chose', known, history })).toBe('CUSTOM')
    expect(guessSource({ title: 'Autre chose', known, history: [{ title: 'x', source: 'KIPRUN' }] })).toBe('KIPRUN')
    expect(guessSource({ title: 'Autre chose', known, history: [] })).toBe('CUSTOM')
  })
  it('RACE n’est jamais repris de l’historique', () => {
    expect(guessSource({ title: '10 km des Étangs', known, history: [{ title: '10 km des Étangs', source: 'RACE' }] })).toBe('CUSTOM')
  })
})

describe('cleanWatchName', () => {
  it.each([
    ['Tapis de course - Footing 40’', 'Tapis de course', 'Footing 40’'],
    ['Namur - 8x400m (R=1’)', 'Namur', '8x400m (R=1’)'],
    ['Braine-l’Alleud - Sortie longue 1h20', 'Braine-l’Alleud', 'Sortie longue 1h20'],
  ])('« %s » : préfixe retiré', (name, prefix, title) => {
    expect(cleanWatchName(name)).toEqual({ prefix, title })
  })

  it.each(['Footing 50’ - 3’ rapide', 'Sortie longue', 'Sortie longue - fin rapide', 'Seuil 3x8’ - récup 2’'])('« %s » reste entier', (name) => {
    expect(cleanWatchName(name)).toEqual({ prefix: null, title: name })
  })
})

describe('displayTitle', () => {
  it('titre Strava sans ses étiquettes', () => {
    expect(displayTitle({ stravaName: '[KIPRUN] - Footing 45’', garminName: 'Tapis de course - Footing 45’' })).toEqual({ title: 'Footing 45’', tags: ['KIPRUN'] })
  })
  it('Strava générique : nom de la montre nettoyé', () => {
    expect(displayTitle({ stravaName: 'Course à pied en soirée', garminName: 'Tapis de course - 8x400m (R=1’)' }).title).toBe('8x400m (R=1’)')
  })
  it('tout est générique : le nom Strava tel quel', () => {
    expect(displayTitle({ stravaName: 'Morning Run', garminName: 'Tapis de course' }).title).toBe('Morning Run')
  })
  it('ancien état sans noms : jamais d’erreur', () => {
    expect(displayTitle({} as never).title).toBe('Course')
  })
})

describe('normalizeTitle', () => {
  it('casse, accents, apostrophes, étiquettes et préfixe de montre', () => {
    expect(normalizeTitle('[KIPRUN] - Séance 8×400m (R=1’)')).toBe("seance 8x400m (r=1')")
    expect(normalizeTitle('Tapis de course - Séance 8x400m (R=1\')')).toBe("seance 8x400m (r=1')")
  })
})
