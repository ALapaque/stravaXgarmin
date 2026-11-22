import { describe, expect, it } from 'vitest'
import type { AdherenceWeek } from '../shared/utils/planmatch'
import { hasPlan, planFollowed, planWeekOk, raceList, runsPerWeek, runsWeekOk, streak } from '../shared/utils/progress'

const wk = (from: string, planned: number, done: number, short = 0, failed = 0, skipped = 0): AdherenceWeek => ({ from, planned, done, short, failed, skipped })

describe('plan suivi', () => {
  it('additionne les semaines ; le pourcentage ne compte que les séances faites en entier', () => {
    const r = planFollowed([wk('2026-10-26', 4, 3, 0, 0, 1), wk('2026-11-02', 4, 2, 1, 1, 0), wk('2026-11-09', 2, 2)])
    expect(r).toEqual({ planned: 10, done: 7, short: 1, failed: 1, skipped: 1, pct: 70, ranPct: 90 })
  })

  it('sans séance prévue : pas de pourcentage, pas de plan', () => {
    const weeks = [wk('2026-11-02', 0, 0), wk('2026-11-09', 0, 0)]
    expect(planFollowed(weeks).pct).toBeNull()
    expect(planFollowed([]).ranPct).toBeNull()
    expect(hasPlan(weeks)).toBe(false)
    expect(hasPlan([...weeks, wk('2026-11-16', 1, 0, 0, 0, 1)])).toBe(true)
  })
})

describe('série en cours', () => {
  it('semaines de suite sans séance sautée ; la semaine en cours ne casse pas la série', () => {
    const weeks = [wk('a', 3, 2, 0, 0, 1), wk('b', 3, 3), wk('c', 4, 3, 1), wk('d', 3, 2, 0, 1), wk('now', 2, 1, 0, 0, 1)]
    expect(streak(weeks, planWeekOk)).toEqual({ weeks: 3, open: false, current: false })
  })

  it('la semaine en cours compte si elle remplit déjà la condition', () => {
    const weeks = [wk('a', 3, 3, 0, 0, 1), wk('b', 3, 3), wk('now', 1, 1)]
    expect(streak(weeks, planWeekOk)).toEqual({ weeks: 2, open: false, current: true })
  })

  it('une semaine sans séance prévue arrête la série ; une série qui remonte au début est « ouverte »', () => {
    expect(streak([wk('a', 3, 3), wk('b', 0, 0), wk('c', 2, 2), wk('now', 0, 0)], planWeekOk)).toEqual({ weeks: 1, open: false, current: false })
    expect(streak([wk('a', 3, 3), wk('b', 2, 2), wk('now', 0, 0)], planWeekOk)).toEqual({ weeks: 2, open: true, current: false })
    expect(streak([], planWeekOk)).toEqual({ weeks: 0, open: false, current: false })
    expect(streak([wk('a', 3, 2, 0, 0, 1), wk('now', 0, 0)], planWeekOk)).toEqual({ weeks: 0, open: false, current: false })
  })

  it('sans plan : au moins 2 courses par semaine', () => {
    expect(streak([{ runs: 1 }, { runs: 2 }, { runs: 3 }, { runs: 0 }], runsWeekOk)).toEqual({ weeks: 2, open: false, current: false })
  })
})

describe('courses par semaine', () => {
  it('semaines du lundi au dimanche, la plus ancienne d’abord, jusqu’à la semaine en cours', () => {
    const runs = [
      { localDate: '2026-11-19', distanceKm: 8 },
      { localDate: '2026-11-16', distanceKm: 5 },
      { localDate: '2026-11-15', distanceKm: 10 },
      { localDate: '2026-10-01', distanceKm: 12 },
    ]
    const w = runsPerWeek(runs, '2026-11-19', 3)
    expect(w.map((x) => x.from)).toEqual(['2026-11-02', '2026-11-09', '2026-11-16'])
    expect(w.map((x) => x.runs)).toEqual([0, 1, 2])
    expect(w[2]).toMatchObject({ km: 13, current: true })
    expect(w[0]!.current).toBe(false)
  })
})

describe('compétitions', () => {
  const run = (id: string, type: string, startedAt: string, name: string, km = 10, sec = 3000) => ({
    id, type, startedAt, localDate: startedAt.slice(0, 10), distanceKm: km, durationSec: sec, stravaName: name, garminName: 'Course à pied',
  })

  it('seulement les compétitions, la plus récente d’abord, avec le titre affiché et l’allure', () => {
    const list = raceList([
      run('r1', 'race', '2026-09-06T08:00:00Z', '[RACE] - Semi des Collines', 21.1, 6600),
      run('e1', 'easy', '2026-11-01T08:00:00Z', '[KIPRUN] - Footing 40’'),
      run('r2', 'race', '2026-11-01T09:00:00Z', '[RACE] - 10 km du Parc', 10, 3330),
    ])
    expect(list.map((r) => r.id)).toEqual(['r2', 'r1'])
    expect(list[0]).toEqual({ id: 'r2', date: '2026-11-01', title: '10 km du Parc', distanceKm: 10, durationSec: 3330, pace: '5:33' })
  })

  it('aucune compétition : liste vide ; distance nulle : pas d’allure', () => {
    expect(raceList([run('e1', 'easy', '2026-11-01T08:00:00Z', 'Footing')])).toEqual([])
    expect(raceList([run('r', 'race', '2026-11-01T08:00:00Z', 'Cross', 0, 1200)])[0]!.pace).toBe('–')
  })
})
