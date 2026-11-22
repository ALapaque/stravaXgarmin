import { describe, expect, it } from 'vitest'
import { adherence, matchPlan, syntheticSession, type MatchRun, type MatchSession } from '../shared/utils/planmatch'

// Courses et séances inventées
const TODAY = '2026-11-20' // un vendredi
const run = (id: string, localDate: string, names: string[], workoutId: number | null = null): MatchRun => ({ id, localDate, names, workoutId })
const ses = (id: string, date: string, title: string, workoutId: number | null = null): MatchSession => ({ id, date, title, workoutId })

describe('matchPlan', () => {
  it('même jour : reliée même sans titre commun', () => {
    const r = matchPlan([run('r1', '2026-11-18', ['Course à pied en soirée'])], [ses('p1', '2026-11-18', 'Footing 40’')], {}, TODAY)
    expect(r).toEqual({ byRun: { r1: 'p1' }, skipped: [] })
  })

  it('la veille avec un titre identique (étiquettes et préfixe de montre ignorés)', () => {
    const runs = [run('r1', '2026-11-17', ['[KIPRUN] - 8x400m (R=1’)', 'Tapis de course - 8x400m (R=1\')'])]
    expect(matchPlan(runs, [ses('p1', '2026-11-18', '8×400m (R=1’)')], {}, TODAY).byRun).toEqual({ r1: 'p1' })
  })

  it('un jour d’écart sans titre commun : pas reliée, et la séance passée est sautée', () => {
    const r = matchPlan([run('r1', '2026-11-17', ['Morning Run'])], [ses('p1', '2026-11-18', 'Footing 40’')], {}, TODAY)
    expect(r).toEqual({ byRun: {}, skipped: ['p1'] })
  })

  it('deux courses le même jour : la séance va à celle dont le titre correspond', () => {
    const runs = [run('r1', '2026-11-18', ['Échauffement']), run('r2', '2026-11-18', ['Tapis de course - Tempo 20’'])]
    expect(matchPlan(runs, [ses('p1', '2026-11-18', 'Tempo 20’')], {}, TODAY).byRun).toEqual({ r2: 'p1' })
  })

  it('même séance Garmin (workoutId)', () => {
    const runs = [run('r1', '2026-11-18', ['Morning Run'], 77), run('r2', '2026-11-18', ['Lunch Run'])]
    expect(matchPlan(runs, [ses('p1', '2026-11-18', 'Seuil', 77)], {}, TODAY).byRun).toEqual({ r1: 'p1' })
  })

  it('choix manuel : il gagne, et « none » laisse la course libre', () => {
    const runs = [run('r1', '2026-11-18', ['Footing 40’']), run('r2', '2026-11-16', ['Morning Run'])]
    const sessions = [ses('p1', '2026-11-18', 'Footing 40’'), ses('p2', '2026-11-12', 'Tempo 20’')]
    expect(matchPlan(runs, sessions, { r1: 'none', r2: 'p1' }, TODAY)).toEqual({ byRun: { r2: 'p1' }, skipped: ['p2'] })
  })

  it('séance du jour même jamais « sautée », séance à venir non plus', () => {
    const sessions = [ses('p1', TODAY, 'Footing 40’'), ses('p2', '2026-11-22', 'Sortie longue 1h20'), ses('p3', '2026-11-19', 'Tempo 20’')]
    expect(matchPlan([], sessions, {}, TODAY).skipped).toEqual(['p3'])
  })
})

describe('adherence', () => {
  it('semaines lundi → dimanche, la plus ancienne d’abord', () => {
    const sessions = [
      ses('p1', '2026-11-10', 'A'), ses('p2', '2026-11-12', 'B'), ses('p3', '2026-11-14', 'C'),
      ses('p4', '2026-11-17', 'D'), ses('p5', '2026-11-19', 'E'), ses('p6', TODAY, 'F'), ses('p7', '2026-11-22', 'G'),
    ]
    const byRun = { r1: 'p1', r2: 'p2', r4: 'p4', r5: 'p5' }
    const w = adherence(sessions, byRun, { r1: 'done', r2: 'failed', r4: 'short', r5: null }, TODAY, 3)
    expect(w).toEqual([
      { from: '2026-11-02', planned: 0, done: 0, short: 0, failed: 0, skipped: 0 },
      { from: '2026-11-09', planned: 3, done: 1, short: 0, failed: 1, skipped: 1 },
      { from: '2026-11-16', planned: 2, done: 1, short: 1, failed: 0, skipped: 0 },
    ])
  })
})

describe('syntheticSession', () => {
  it('nom de montre « Tapis de course - Séance » : séance déduite avec ses étapes', () => {
    const s = syntheticSession({ id: 'r1', localDate: '2026-11-19', garminName: 'Tapis de course - 8x400m (R=1’)' })!
    expect(s).toMatchObject({ id: 'nom:r1', synthetic: true, title: '8x400m (R=1’)', date: '2026-11-19' })
    expect(s.steps[0]).toMatchObject({ kind: 'repeat', reps: 8 })
  })
  it('titre de séance reconnu sans préfixe', () => {
    expect(syntheticSession({ id: 'r1', localDate: '2026-11-19', garminName: 'Footing 40’' })).toMatchObject({ title: 'Footing 40’', steps: [{ sec: 2400 }] })
  })
  it('nom par défaut ou nom libre : rien', () => {
    expect(syntheticSession({ id: 'r1', localDate: '2026-11-19', garminName: 'Bruxelles Course à pied' })).toBeNull()
    expect(syntheticSession({ id: 'r1', localDate: '2026-11-19', garminName: 'Sortie avec les copains' })).toBeNull()
    expect(syntheticSession({ id: 'r1', localDate: '2026-11-19', garminName: undefined })).toBeNull()
  })
})
