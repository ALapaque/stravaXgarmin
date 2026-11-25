import { describe, expect, it } from 'vitest'
import { comparePlan } from '../shared/utils/compliance'
import { needsDebrief } from '../shared/utils/debrief'
import { buildDemo, demoStream, demoWatchZones, demoWatchZonesBefore, demoZoneFloors } from '../shared/utils/demo'
import { matchPlan } from '../shared/utils/planmatch'
import { detectConvention, displayTitle } from '../shared/utils/titles'
import { timeInZones, validFloors } from '../shared/utils/zones'

const DAY = 86_400_000

// Plusieurs jours : hiver, été (heure d'été), un lundi, un 1er janvier
describe.each(['2026-11-22', '2026-07-15', '2026-11-23', '2027-01-01'])('buildDemo(%s)', (today) => {
  const demo = buildDemo(today)
  const runs = demo.activities
  const sessions = demo.plan
  const match = matchPlan(
    runs.map((a) => ({ id: a.id, localDate: a.localDate, names: [a.stravaName, a.garminName], workoutId: a.garminWorkoutId ?? null })),
    sessions,
    Object.fromEntries(Object.entries(demo.debriefs).filter(([, d]) => d.planId).map(([id, d]) => [id, d.planId!])),
    today,
  )
  const result = (id: string) => {
    const a = runs.find((r) => r.id === id)!
    const s = sessions.find((x) => x.id === match.byRun[id])!
    return comparePlan(s, { durationSec: a.durationSec, distanceM: a.distanceKm * 1000, laps: a.laps })!
  }

  it('déterministe', () => {
    expect(buildDemo(today)).toEqual(demo)
  })

  it('identifiants a1…a4 gardés, a2 hier', () => {
    for (const id of ['a1', 'a2', 'a3', 'a4']) expect(runs.some((a) => a.id === id)).toBe(true)
    const yesterday = new Date(Date.parse(`${today}T12:00:00Z`) - DAY).toISOString().slice(0, 10)
    expect(runs.find((a) => a.id === 'a2')!.localDate).toBe(yesterday)
    expect(runs[0]!.id).toBe('a2')
  })

  it('somme des tours = distance et durée de chaque course ; splits cohérents', () => {
    for (const a of runs) {
      const laps = a.laps!
      expect(laps.length).toBeGreaterThan(0)
      expect(laps.reduce((s, l) => s + l.sec, 0)).toBe(a.durationSec)
      expect(Math.abs(laps.reduce((s, l) => s + l.m, 0) / 1000 - a.distanceKm)).toBeLessThanOrEqual(0.05)
      expect(a.splits).toHaveLength(Math.floor(laps.reduce((s, l) => s + l.m, 0) / 1000 + 0.0005))
      expect(a.splitHr).toHaveLength(a.splits.length)
      expect(a.maxHr).toBeGreaterThanOrEqual(a.avgHr)
    }
  })

  it('issues : a2 écourtée 5 sur 8, la séance ratée 2 sur 6, les footings faits', () => {
    expect(result('a2')).toMatchObject({ outcome: 'short', doneReps: 5, plannedReps: 8 })
    expect(result('a5')).toMatchObject({ outcome: 'failed', doneReps: 2, plannedReps: 6 })
    const footings = runs.filter((a) => match.byRun[a.id] && sessions.find((s) => s.id === match.byRun[a.id])!.title.startsWith('Footing'))
    expect(footings.length).toBeGreaterThanOrEqual(4)
    for (const f of footings) expect(result(f.id).outcome).toBe('done')
    // Toutes les autres séances du plan faites sont « faites »
    for (const id of Object.keys(match.byRun)) if (id !== 'a2' && id !== 'a5') expect(result(id).outcome).toBe('done')
  })

  it('chaque séance passée a des étapes ; deux séances sautées', () => {
    expect(sessions.filter((s) => s.date < today).every((s) => s.steps.length > 0)).toBe(true)
    expect(match.skipped).toHaveLength(2)
    expect(sessions.filter((s) => s.date >= today)).toHaveLength(4)
    // Une séance aujourd'hui, pas encore faite (carte « Aujourd’hui » et anneau dans « Ta semaine »)
    expect(sessions.some((s) => s.date === today && !Object.values(match.byRun).includes(s.id))).toBe(true)
    expect(sessions.some((s) => s.date === today || s.date === new Date(Date.parse(`${today}T12:00:00Z`) + DAY).toISOString().slice(0, 10))).toBe(true)
  })

  it('seule a2 est à débriefer', () => {
    const convention = detectConvention(runs.map((a) => a.stravaName)).enabled
    expect(convention).toBe(true)
    const todo = runs.filter((a) => needsDebrief(a, demo.debriefs, { since: demo.debriefSince, convention }))
    expect(todo.map((a) => a.id)).toEqual(['a2'])
  })

  it('une seule compétition, avec record sur 10 km', () => {
    const races = runs.filter((a) => a.type === 'race')
    expect(races).toHaveLength(1)
    expect(races[0]!.prs).toContain('10k')
    const best10 = Math.min(...runs.map((a) => a.bestEfforts['10k'] ?? Infinity))
    expect(races[0]!.bestEfforts['10k']).toBe(best10)
    // Aucun autre « meilleur temps » ne bat un temps plus ancien (pas de faux record sur un footing)
    const chrono = [...runs].sort((a, b) => a.startedAt.localeCompare(b.startedAt))
    let best = Infinity
    for (const a of chrono) {
      const t = a.bestEfforts['5k']
      if (t === undefined) continue
      if (a.type !== 'race' && best < Infinity) expect(t).toBeGreaterThanOrEqual(best)
      best = Math.min(best, t)
    }
  })

  it('environ 6 sur 10 sur tapis, sans tracé ni lieu', () => {
    const share = runs.filter((a) => a.indoor).length / runs.length
    expect(share).toBeGreaterThanOrEqual(0.5)
    expect(share).toBeLessThanOrEqual(0.7)
    for (const a of runs.filter((r) => r.indoor)) {
      expect(a.place).toBe('tapis')
      expect(a.route).toBeUndefined()
      expect(a.elevationM).toBe(0)
    }
  })

  it('aucune course dans le futur, toutes dans les 45 derniers jours', () => {
    const end = Date.parse(`${today}T23:59:59Z`)
    for (const a of runs) {
      expect(a.localDate <= today).toBe(true)
      expect(Date.parse(a.startedAt)).toBeLessThan(end)
      expect(Date.parse(`${today}T12:00:00Z`) - Date.parse(`${a.localDate}T12:00:00Z`)).toBeLessThanOrEqual(45 * DAY)
    }
  })

  it('titres à la convention, une ou deux [CUSTOM], titres affichés nettoyés', () => {
    const custom = runs.filter((a) => a.stravaName.startsWith('[CUSTOM]'))
    expect(custom.length).toBeGreaterThanOrEqual(1)
    expect(custom.length).toBeLessThanOrEqual(2)
    expect(displayTitle(runs.find((a) => a.id === 'a2')!).title).toBe('8x400m (R=1’)')
    expect(runs.every((a) => !displayTitle(a).title.startsWith('['))).toBe(true)
  })

  it('historique et notifications pointent vers des courses existantes', () => {
    const ids = new Set(runs.map((a) => a.id))
    for (const h of demo.history) expect(ids.has(h.activityId)).toBe(true)
    for (const n of demo.notifications) if (n.to?.startsWith('/activites/')) expect(ids.has(n.to.split('/')[2]!)).toBe(true)
  })

  it('zones de démo (montre et Strava) : seuils plausibles, et un footing passé en endurance', () => {
    const watch = demoWatchZones(runs)
    expect(validFloors(watch.floors)).toEqual(watch.floors)
    expect(watch.low).toBeLessThan(watch.floors[0]!)
    expect(watch.method).toBe('reserve')
    const floors = demoZoneFloors(runs)
    expect(validFloors(floors)).toEqual(floors)
    // Avant son dernier réglage, la montre de démo avait d'autres zones : les vieilles courses de la démo sont relues
    const before = demoWatchZonesBefore(runs)
    expect(validFloors(before.floors)).toEqual(before.floors)
    expect(before.floors).not.toEqual(watch.floors)
    expect(runs.some((r) => Date.parse(r.startedAt) < Date.parse(`${today}T12:00:00Z`) - 15 * DAY)).toBe(true)
    // La montre et Strava ne découpent pas pareil : c'est ce que la démo montre
    expect(watch.floors).not.toEqual(floors)
    const easy = runs.find((r) => r.type === 'easy' && r.avgHr > 0)!
    for (const f of [watch.floors, floors]) {
      const sec = timeInZones(demoStream(easy), f)!
      // Zones 1 et 2 : l'essentiel d'un footing (plus de « Tempo » pour une sortie facile)
      expect((sec[0]! + sec[1]!) / sec.reduce((x, y) => x + y, 0)).toBeGreaterThan(0.6)
    }
  })

  it('demoStream : courbes tirées des tours', () => {
    const a2 = runs.find((a) => a.id === 'a2')!
    const s = demoStream(a2)
    expect(s.t.length).toBeGreaterThan(50)
    expect(s.t[s.t.length - 1]).toBe(a2.durationSec)
    expect(s.hr).not.toBeNull()
  })
})

describe('buildDemo : débriefs déjà publiés', () => {
  it('un débrief fait dont le titre Strava porte la convention est publié ; la course d’hier ne l’est pas', () => {
    const demo = buildDemo('2026-11-22')
    const done = Object.entries(demo.debriefs).filter(([, d]) => d.status === 'done')
    expect(done.length).toBeGreaterThan(3)
    for (const [id, d] of done) {
      const run = demo.activities.find((a) => a.id === id)!
      expect(Boolean(d.publishedAt), id).toBe(detectConvention([run.stravaName, run.stravaName, run.stravaName]).enabled)
    }
    expect(demo.debriefs.a5?.publishedAt).toBeTruthy()
    expect(demo.debriefs.a2).toBeUndefined()
  })
})
