import { describe, expect, it } from 'vitest'
import { brusselsDay, formatAgo, formatDay, formatDuration, formatHours, formatKm, formatPace, formatTime, placeLabel } from '../shared/utils/format'

describe('formats', () => {
  it('durée', () => {
    expect(formatDuration(3912)).toBe('1:05:12')
    expect(formatDuration(2550)).toBe('42:30')
    expect(formatDuration(59)).toBe('0:59')
  })

  it('allure', () => {
    expect(formatPace(2550, 8)).toBe('5:19')
    expect(formatPace(300, 1)).toBe('5:00')
  })

  it('kilomètres au format belge', () => {
    expect(formatKm(12.4)).toBe('12,4')
    expect(formatKm(5)).toBe('5,0')
  })

  it('heures', () => {
    expect(formatHours(8520)).toBe('2 h 22')
    expect(formatHours(2700)).toBe('45 min')
  })

  it('jour et heure à Bruxelles', () => {
    expect(formatDay('2026-11-17T17:42:00Z')).toBe('Mardi 17 novembre')
    expect(formatTime('2026-11-17T17:42:00Z')).toBe('18:42')
    // 23 h 30 UTC = déjà le lendemain à Bruxelles
    expect(formatDay('2026-11-17T23:30:00Z')).toBe('Mercredi 18 novembre')
  })
})

describe('formatAgo', () => {
  const now = Date.parse('2026-11-20T12:00:00Z')
  const ago = (sec: number) => new Date(now - sec * 1000).toISOString()

  it('valeur absente ou illisible', () => {
    expect(formatAgo(null, now)).toBe('jamais')
    expect(formatAgo(undefined, now)).toBe('jamais')
    expect(formatAgo('', now)).toBe('jamais')
    expect(formatAgo('pas une date', now)).toBe('jamais')
  })

  it('à l’instant (et dans le futur)', () => {
    expect(formatAgo(ago(0), now)).toBe('à l’instant')
    expect(formatAgo(ago(59), now)).toBe('à l’instant')
    expect(formatAgo(ago(-600), now)).toBe('à l’instant')
  })

  it('minutes, heures, hier, jours', () => {
    expect(formatAgo(ago(60), now)).toBe('il y a 1 min')
    expect(formatAgo(ago(3 * 60 + 20), now)).toBe('il y a 3 min')
    expect(formatAgo(ago(59 * 60 + 59), now)).toBe('il y a 59 min')
    expect(formatAgo(ago(3600), now)).toBe('il y a 1 h')
    expect(formatAgo(ago(2 * 3600 + 100), now)).toBe('il y a 2 h')
    expect(formatAgo(ago(23 * 3600 + 3599), now)).toBe('il y a 23 h')
    expect(formatAgo(ago(24 * 3600), now)).toBe('hier')
    expect(formatAgo(ago(47 * 3600), now)).toBe('hier')
    expect(formatAgo(ago(48 * 3600), now)).toBe('il y a 2 jours')
    expect(formatAgo(ago(3 * 86_400 + 10), now)).toBe('il y a 3 jours')
    expect(formatAgo(ago(7 * 86_400 - 1), now)).toBe('il y a 6 jours')
  })

  it('au-delà d’une semaine : la date', () => {
    expect(formatAgo('2026-11-03T10:00:00Z', now)).toBe('le 3 nov.')
    // Minuit passé à Bruxelles, pas encore en UTC
    expect(formatAgo('2026-10-31T23:30:00Z', now)).toBe('le 1 nov.')
  })
})

describe('brusselsDay et placeLabel', () => {
  it('jour à Bruxelles, autour de minuit', () => {
    expect(brusselsDay('2026-11-17T23:30:00Z')).toBe('2026-11-18')
    expect(brusselsDay('2026-07-01T21:59:00Z')).toBe('2026-07-01')
    expect(brusselsDay('')).toBe('')
  })
  it('« Tapis » sur tapis, sinon le lieu', () => {
    expect(placeLabel({ indoor: true, place: 'tapis' })).toBe('Tapis')
    expect(placeLabel({ indoor: false, place: 'quais' })).toBe('quais')
    expect(placeLabel({ place: undefined })).toBe('')
  })
})
