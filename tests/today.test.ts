import { describe, expect, it } from 'vitest'
import { daysBetween, mondayOf, pickFocus, todayAlerts, weekView, type DayRun } from '../shared/utils/today'

// Jeudi 19 novembre 2026 (inventé) : la semaine va du lundi 16 au dimanche 22
const TODAY = '2026-11-19'
const run = (id: string, localDate: string, km = 8, type = 'easy'): DayRun => ({ id, localDate, type, distanceKm: km, durationSec: km * 360 })

describe('dates', () => {
  it('lundi de la semaine et écart en jours', () => {
    expect(mondayOf('2026-11-19')).toBe('2026-11-16')
    expect(mondayOf('2026-11-16')).toBe('2026-11-16')
    expect(mondayOf('2026-11-22')).toBe('2026-11-16')
    expect(daysBetween('2026-11-16', '2026-11-22')).toBe(6)
  })
})

describe('carte principale d’Aujourd’hui', () => {
  const sessions = [
    { id: 's-hier', date: '2026-11-18' },
    { id: 's-auj', date: TODAY },
    { id: 's-dem', date: '2026-11-20' },
    { id: 's-sam', date: '2026-11-21' },
  ]

  it('1. une course à débriefer passe avant tout, avec le nombre des autres', () => {
    const r = pickFocus({ toDebrief: ['r2', 'r1', 'r0'], sessions, done: [], lastRun: 'r2', today: TODAY })
    expect(r.main).toEqual({ kind: 'debrief', runId: 'r2', more: 2 })
    // La séance du jour suit ; la dernière course est déjà la carte principale : pas répétée
    expect(r.secondary).toEqual([{ kind: 'today', sessionId: 's-auj' }])
  })

  it('1 bis. la dernière course reste une carte normale si ce n’est pas celle à débriefer', () => {
    const r = pickFocus({ toDebrief: ['r1'], sessions: [], done: [], lastRun: 'r2', today: TODAY })
    expect(r.secondary).toEqual([{ kind: 'last', runId: 'r2' }])
  })

  it('2. sinon la séance du jour pas encore faite', () => {
    const r = pickFocus({ toDebrief: [], sessions, done: [], lastRun: 'r2', today: TODAY })
    expect(r.main).toEqual({ kind: 'today', sessionId: 's-auj' })
    expect(r.secondary).toEqual([{ kind: 'last', runId: 'r2' }])
  })

  it('3. séance du jour déjà faite : la prochaine (jamais une séance passée)', () => {
    const r = pickFocus({ toDebrief: [], sessions, done: ['s-auj'], lastRun: 'r2', today: TODAY })
    expect(r.main).toEqual({ kind: 'next', sessionId: 's-dem' })
    const r2 = pickFocus({ toDebrief: [], sessions: [sessions[0]!], done: [], lastRun: 'r2', today: TODAY })
    expect(r2.main).toEqual({ kind: 'last', runId: 'r2' })
  })

  it('3 bis. l’ordre des séances reçues ne compte pas', () => {
    const r = pickFocus({ toDebrief: [], sessions: [sessions[3]!, sessions[2]!], done: [], lastRun: null, today: TODAY })
    expect(r.main).toEqual({ kind: 'next', sessionId: 's-dem' })
    expect(r.secondary).toEqual([])
  })

  it('4. sans plan : la dernière course ; sans rien : vide', () => {
    expect(pickFocus({ toDebrief: [], sessions: [], done: [], lastRun: 'r2', today: TODAY })).toEqual({ main: { kind: 'last', runId: 'r2' }, secondary: [] })
    expect(pickFocus({ toDebrief: [], sessions: [], done: [], lastRun: null, today: TODAY })).toEqual({ main: { kind: 'empty' }, secondary: [] })
  })
})

describe('Ta semaine', () => {
  const sessions = [
    { id: 'lun', date: '2026-11-16' },
    { id: 'mar', date: '2026-11-17' },
    { id: 'jeu', date: TODAY },
    { id: 'sam', date: '2026-11-21' },
  ]
  const runs = [run('a', '2026-11-16', 10, 'interval'), run('b', '2026-11-18', 6), run('c', '2026-11-18', 12, 'long'), run('old', '2026-11-10', 9), run('prev', '2026-11-12', 5)]

  it('état de chaque jour : faite, sautée, prévue, rien', () => {
    const w = weekView({ today: TODAY, runs, sessions, done: ['lun'] })
    expect(w.from).toBe('2026-11-16')
    expect(w.to).toBe('2026-11-22')
    expect(w.days.map((d) => d.state)).toEqual(['done', 'skipped', 'done', 'planned', 'rest', 'planned', 'rest'])
    expect(w.days[3]!.isToday).toBe(true)
    expect(w.days[4]!.isFuture).toBe(true)
    // Deux courses le même jour : la plus longue d'abord
    expect(w.days[2]!.runs.map((r) => r.id)).toEqual(['c', 'b'])
    expect(w.days[2]!.km).toBe(18)
  })

  it('une course un jour de séance sautée compte comme faite (même si elle n’y est pas reliée)', () => {
    const w = weekView({ today: TODAY, runs: [run('x', '2026-11-17')], sessions, done: [] })
    expect(w.days[1]!.state).toBe('done')
  })

  it('totaux : séances faites sur prévues (à venir comprises), kilomètres, temps', () => {
    const w = weekView({ today: TODAY, runs, sessions, done: ['lun'] })
    expect(w.planned).toBe(4)
    expect(w.doneSessions).toBe(1)
    expect(w.runs).toBe(3)
    expect(w.km).toBe(28)
    expect(w.sec).toBe(28 * 360)
  })

  it('comparaison avec la semaine passée aux mêmes jours', () => {
    const w = weekView({ today: TODAY, runs, sessions: [], done: [] })
    // Lundi 9 → jeudi 12 : 9 + 5 km
    expect(w.previousKm).toBe(14)
    expect(w.deltaKm).toBe(14)
    expect(w.fullWeek).toBe(false)
    expect(weekView({ today: '2026-11-22', runs, sessions: [], done: [] }).fullWeek).toBe(true)
  })

  it('sans plan : seulement les courses', () => {
    const w = weekView({ today: TODAY, runs: [], sessions: [], done: [] })
    expect(w.days.every((d) => d.state === 'rest')).toBe(true)
    expect(w.planned).toBe(0)
  })
})

describe('alertes', () => {
  it('rien à dire : aucune alerte', () => {
    expect(todayAlerts({})).toEqual([])
    expect(todayAlerts({ core: null, ramp: { pct: 12, high: false }, shoes: [{ name: 'Paire A', km: 200, soon: false }], goal: { days: 40, label: 'Semi' } })).toEqual([])
  })

  it('lecture en échec, charge, chaussures, objectif proche', () => {
    const a = todayAlerts({
      core: 'garmin.activities',
      ramp: { pct: 34, high: true },
      shoes: [{ name: 'Paire A', km: 640.4, soon: true }, { name: 'Paire B', km: 100, soon: false }],
      goal: { name: 'Course des collines', days: 12, label: 'Semi' },
    })
    expect(a).toEqual([
      { kind: 'health', text: 'Garmin n’a pas répondu', to: '/reglages/etat' },
      { kind: 'load', text: 'Charge +34 % cette semaine', to: '/progression' },
      { kind: 'shoes', text: 'Paire A à 640 km', to: '/progression?onglet=materiel' },
      { kind: 'goal', text: 'J-12 · Course des collines', to: '/objectif' },
    ])
  })

  it('objectif : le jour J, sans nom, passé ou trop loin', () => {
    expect(todayAlerts({ goal: { days: 0, label: 'Semi' } })[0]!.text).toBe('Jour J · Semi')
    expect(todayAlerts({ goal: { days: 15, label: 'Semi' } })).toEqual([])
    expect(todayAlerts({ goal: { days: -2, past: true, label: 'Semi' } })).toEqual([])
    expect(todayAlerts({ core: 'strava.activities' })[0]!.text).toBe('Strava n’a pas répondu')
  })
})
