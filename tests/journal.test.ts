import { describe, expect, it } from 'vitest'
import { journalWeeks, weekLabel } from '../shared/utils/journal'

// Jeudi 19 novembre 2026 (inventé)
const TODAY = '2026-11-19'
const run = (id: string, localDate: string, hour = 18, km = 8) => ({ id, localDate, startedAt: `${localDate}T${String(hour).padStart(2, '0')}:00:00Z`, distanceKm: km })

describe('titre des semaines', () => {
  it('cette semaine, la semaine dernière, puis la date du lundi', () => {
    expect(weekLabel('2026-11-16', TODAY)).toBe('Cette semaine')
    expect(weekLabel('2026-11-09', TODAY)).toBe('La semaine dernière')
    expect(weekLabel('2026-11-02', TODAY)).toBe('Semaine du 2 novembre')
    expect(weekLabel('2025-12-29', '2026-01-20')).toBe('Semaine du 29 décembre 2025')
  })
})

describe('ligne de temps du journal', () => {
  const sessions = [
    { id: 's1', date: '2026-11-17', title: 'Footing 45’' },
    { id: 's2', date: '2026-11-18', title: 'Fractionné' },
    { id: 's3', date: '2026-11-21', title: 'Sortie longue' },
    { id: 's0', date: '2026-11-03', title: 'Footing 30’' },
  ]
  const runs = [run('a', '2026-11-18', 7), run('b', '2026-11-18', 19, 5), run('c', '2026-11-12'), run('d', '2026-11-04')]

  it('semaines de la plus récente à la plus ancienne, vides comprises', () => {
    const w = journalWeeks({ today: TODAY, runs: [run('x', '2026-11-18'), run('y', '2026-10-27')], sessions: [], done: [] })
    expect(w.map((x) => x.from)).toEqual(['2026-11-16', '2026-11-09', '2026-11-02', '2026-10-26'])
    expect(w[1]!.items).toEqual([])
    expect(w[2]!.items).toEqual([])
    expect(w[0]!.current).toBe(true)
  })

  it('courses du plus récent au plus ancien, séance sautée en ligne fantôme', () => {
    const w = journalWeeks({ today: TODAY, runs, sessions, done: ['s2'] })
    expect(w[0]!.items).toEqual([
      { kind: 'run', id: 'b', date: '2026-11-18' },
      { kind: 'run', id: 'a', date: '2026-11-18' },
      { kind: 'skipped', id: 's1', date: '2026-11-17', title: 'Footing 45’' },
    ])
    // Séance à venir : jamais sautée
    expect(w[0]!.items.some((x) => x.id === 's3')).toBe(false)
  })

  it('le même jour, les courses passent avant la séance sautée', () => {
    const w = journalWeeks({ today: TODAY, runs: [run('z', '2026-11-17')], sessions: [sessions[0]!], done: [] })
    expect(w[0]!.items.map((x) => x.kind)).toEqual(['run', 'skipped'])
  })

  it('totaux de chaque semaine : kilomètres, courses, séances faites sur prévues', () => {
    const w = journalWeeks({ today: TODAY, runs, sessions, done: ['s2'] })
    expect(w[0]).toMatchObject({ km: 13, runs: 2, planned: 3, done: 1, label: 'Cette semaine' })
    expect(w[1]).toMatchObject({ km: 8, runs: 1, planned: 0, done: 0, label: 'La semaine dernière' })
    expect(w[2]).toMatchObject({ runs: 1, planned: 1, done: 0, label: 'Semaine du 2 novembre' })
    expect(w[2]!.items.map((x) => x.id)).toEqual(['d', 's0'])
  })

  it('une séance sautée plus ancienne que les courses étend la ligne de temps', () => {
    const w = journalWeeks({ today: TODAY, runs: [run('x', '2026-11-18')], sessions: [{ id: 'old', date: '2026-10-28', title: 'Footing' }], done: [] })
    expect(w.at(-1)!.from).toBe('2026-10-26')
    expect(w.at(-1)!.items[0]).toMatchObject({ kind: 'skipped', id: 'old' })
  })

  it('rien du tout : aucune semaine', () => {
    expect(journalWeeks({ today: TODAY, runs: [], sessions: [{ id: 'f', date: '2026-11-25', title: 'Plus tard' }], done: [] })).toEqual([])
  })
})
