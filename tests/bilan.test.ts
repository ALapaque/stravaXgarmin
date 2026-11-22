import { describe, expect, it } from 'vitest'
import { defaultBilanWeek, pickBilanWeek, reviewContext, reviewContextLines, weekPlan } from '../shared/utils/bilan'

// Jeudi 19 novembre 2026 (inventé) : la semaine va du lundi 16 au dimanche 22
const TODAY = '2026-11-19'

describe('semaine du bilan', () => {
  it('la semaine en cours dès qu’elle a une course ; sinon, et le lundi, la semaine passée', () => {
    expect(defaultBilanWeek(TODAY, ['2026-11-17'])).toBe('2026-11-16')
    expect(defaultBilanWeek(TODAY, ['2026-11-12'])).toBe('2026-11-09')
    expect(defaultBilanWeek('2026-11-16', ['2026-11-16'])).toBe('2026-11-09')
  })

  it('semaine demandée : ramenée au lundi, bornée aux 8 semaines revues', () => {
    expect(pickBilanWeek('2026-11-11', TODAY)).toBe('2026-11-09')
    expect(pickBilanWeek('2026-12-01', TODAY)).toBe('2026-11-16')
    expect(pickBilanWeek('2026-01-05', TODAY)).toBe('2026-09-28')
    for (const bad of [undefined, '', 'demain', '2026-13-45', ['2026-11-09'], 42]) expect(pickBilanWeek(bad, TODAY)).toBeNull()
  })
})

describe('plan suivi de la semaine', () => {
  const sessions = [
    { id: 's5', date: '2026-11-21', title: 'Sortie longue 1h20' },
    { id: 's1', date: '2026-11-16', title: 'Footing 40’' },
    { id: 's2', date: '2026-11-17', title: '8x400m' },
    { id: 's3', date: '2026-11-18', title: 'Tempo 20’' },
    { id: 's4', date: TODAY, title: 'Footing 30’' },
    { id: 'x', date: '2026-11-13', title: 'Autre semaine' },
  ]

  it('issues des séances, sautées, du jour et à venir ; la séance du jour avec une course compte', () => {
    const r = weekPlan(sessions, { r1: 's1', r2: 's2', r4: 's4' }, { r1: 'done', r2: 'short', r4: null }, '2026-11-16', TODAY)
    expect(r.sessions.map((s) => [s.id, s.status, s.runId])).toEqual([
      ['s1', 'done', 'r1'],
      ['s2', 'short', 'r2'],
      ['s3', 'skipped', null],
      ['s4', 'done', 'r4'],
      ['s5', 'upcoming', null],
    ])
    expect(r).toMatchObject({ planned: 4, done: 2, short: 1, failed: 0, skipped: 1, ahead: 1 })
  })

  it('la séance du jour sans course n’est ni comptée ni sautée', () => {
    const r = weekPlan(sessions, {}, {}, '2026-11-16', TODAY)
    expect(r.sessions.find((s) => s.id === 's4')!.status).toBe('today')
    expect(r).toMatchObject({ planned: 3, skipped: 3, ahead: 2 })
  })
})

describe('ce qui part chez l’IA', () => {
  const plan = weekPlan([{ id: 's1', date: '2026-11-16', title: 'Footing 40’' }, { id: 's2', date: '2026-11-17', title: '8x400m' }], { r1: 's1' }, { r1: 'failed' }, '2026-11-16', TODAY)

  it('le plan suivi et les ressentis sur 10, jamais la note écrite', () => {
    const ctx = reviewContext({
      plan,
      runs: [
        { id: 'r1', localDate: '2026-11-16', title: 'Footing 40’' },
        { id: 'r9', localDate: '2026-11-18', title: 'Sortie libre' },
        { id: 'r8', localDate: '2026-11-18', title: 'Sans débrief' },
      ],
      debriefs: { r1: { rpe: 8, note: 'Texte personnel à ne jamais envoyer' }, r9: { rpe: 42, note: 'non plus' } },
    })
    expect(ctx).toEqual({
      plan: { planned: 2, done: 0, short: 0, failed: 1, skipped: 1, sessions: [{ day: '2026-11-16', title: 'Footing 40’', status: 'failed' }, { day: '2026-11-17', title: '8x400m', status: 'skipped' }] },
      feelings: [{ day: '2026-11-16', title: 'Footing 40’', rpe: 8 }],
    })
    expect(JSON.stringify(ctx)).not.toContain('personnel')
  })

  it('rien à dire : objet vide', () => {
    expect(reviewContext({ plan: null, runs: [{ id: 'r1', localDate: TODAY, title: 'x' }], debriefs: {} })).toEqual({})
  })

  it('côté serveur : lignes bornées, champs inconnus et notes écrites ignorés', () => {
    const lines = reviewContextLines({
      plan: { planned: 2, done: 0, short: 0, failed: 1, skipped: 1, sessions: [{ day: '2026-11-16', title: 'Footing 40’', status: 'failed' }, { title: 'x', status: 'zzz' }] },
      feelings: [{ day: '2026-11-16', title: 'Footing 40’', rpe: 8, note: 'secret' }, { rpe: 0 }, 'n’importe quoi'],
    })
    expect(lines).toEqual([
      'Plan suivi : 0 séances faites, 0 écourtées, 1 ratées, 1 sautées, sur 2 prévues.',
      'Séances prévues cette semaine : 2026-11-16 Footing 40’ (ratée)',
      'Ressenti du coureur (effort perçu sur 10) : 2026-11-16 Footing 40’ : 8/10',
    ])
    expect(lines.join(' ')).not.toContain('secret')
    expect(reviewContextLines(null)).toEqual([])
    expect(reviewContextLines({ plan: 'x', feelings: {} })).toEqual([])
  })
})
