import { describe, expect, it } from 'vitest'
import {
  diagnosticText, emptyEntry, emptyHealth, HEALTH_INFO, HEALTH_KEYS, HEALTH_SOURCES, healthSummary, markError, markOk, maskPrivate,
} from '../shared/utils/health'

const T1 = '2026-11-20T10:00:00.000Z'
const T2 = '2026-11-20T11:00:00.000Z'
const ALL = { strava: true, garmin: true, ai: true }

describe('état de chaque lecture', () => {
  it('emptyHealth : toutes les sources, jamais lues', () => {
    const h = emptyHealth()
    expect(Object.keys(h).sort()).toEqual([...HEALTH_KEYS].sort())
    expect(h.ai).toEqual({ status: 'idle', at: null, okAt: null, error: null, code: null, info: null })
    expect(HEALTH_SOURCES).toHaveLength(12)
  })

  it('markOk puis markError : la dernière réussite et ce qui a été lu restent', () => {
    const ok = markOk(emptyEntry(), T1, '16 courses')
    expect(ok).toEqual({ status: 'ok', at: T1, okAt: T1, error: null, code: null, info: '16 courses' })
    const ko = markError(ok, T2, 'Strava a refusé la requête (502)', 502)
    expect(ko).toEqual({ status: 'error', at: T2, okAt: T1, error: 'Strava a refusé la requête (502)', code: 502, info: '16 courses' })
    // Une nouvelle réussite efface l'erreur ; sans info, l'ancienne est gardée
    expect(markOk(ko, T2)).toEqual({ status: 'ok', at: T2, okAt: T2, error: null, code: null, info: '16 courses' })
    // Erreur sans code
    expect(markError(undefined, T2, 'Pas de réponse').code).toBeNull()
  })
})

describe('healthSummary', () => {
  it('tout va bien : dernière lecture = le dernier essai', () => {
    const h = emptyHealth()
    h['strava.activities'] = markOk(h['strava.activities'], T1)
    h['garmin.plan'] = markOk(h['garmin.plan'], T2)
    expect(healthSummary(h, ALL)).toEqual({ errors: [], lastAt: T2, core: null })
  })

  it('les sources d’un compte non connecté sont ignorées', () => {
    const h = emptyHealth()
    h['garmin.activities'] = markError(h['garmin.activities'], T2, 'Session expirée', 401)
    h['garmin.forme'] = markError(h['garmin.forme'], T2, 'Garmin ne répond pas', 502)
    h['strava.activities'] = markOk(h['strava.activities'], T1)
    expect(healthSummary(h, { strava: true, garmin: false, ai: false })).toEqual({ errors: [], lastAt: T1, core: null })
    const s = healthSummary(h, ALL)
    expect(s.errors).toEqual(['garmin.activities', 'garmin.forme'])
    expect(s.core).toBe('garmin.activities')
  })

  it('core : Strava d’abord, une lecture secondaire ne compte pas', () => {
    const h = emptyHealth()
    h['strava.gear'] = markError(h['strava.gear'], T1, 'x', 502)
    expect(healthSummary(h, ALL).core).toBeNull()
    h['garmin.activities'] = markError(h['garmin.activities'], T1, 'x', 502)
    h['strava.activities'] = markError(h['strava.activities'], T1, 'x', 429)
    expect(healthSummary(h, ALL).core).toBe('strava.activities')
  })

  it('état sauvegardé incomplet (ancienne version) : pas d’erreur', () => {
    expect(healthSummary({}, ALL)).toEqual({ errors: [], lastAt: null, core: null })
  })
})

describe('ce qui a été lu, en mots', () => {
  it('sous-titres', () => {
    expect(HEALTH_INFO.activities(16)).toBe('16 courses sur les 60 derniers jours')
    expect(HEALTH_INFO.activities(1)).toBe('1 course sur les 60 derniers jours')
    expect(HEALTH_INFO.details(12, 12)).toBe('Temps au kilomètre et meilleurs efforts de 12 courses')
    expect(HEALTH_INFO.details(9, 15)).toBe('9 courses sur 15, la suite à la prochaine lecture')
    expect(HEALTH_INFO.gear(2)).toBe('2 paires')
    expect(HEALTH_INFO.gear(1)).toBe('1 paire')
    expect(HEALTH_INFO.garminActivities(24)).toBe('24 activités')
    expect(HEALTH_INFO.plan(5)).toBe('5 séances à venir')
    expect(HEALTH_INFO.plan(5, 14)).toBe('5 séances à venir, 14 passées')
    expect(HEALTH_INFO.plan(1, 1)).toBe('1 séance à venir, 1 passée')
    expect(HEALTH_INFO.streams({ hr: [1], v: [2] })).toBe('Cardio et allure')
    expect(HEALTH_INFO.streams({ hr: null, v: [2] })).toBe('Allure seulement')
    expect(HEALTH_INFO.streams({})).toBe('Aucune courbe pour cette course')
    expect(HEALTH_INFO.zones({ available: true, zones: { floors: [124, 154, 169, 184], custom: false } })).toBe('Zones de ton compte : seuils à 124, 154, 169, 184 bpm')
    expect(HEALTH_INFO.zones({ available: true, zones: { floors: [130, 150, 165, 180], custom: true } })).toBe('Zones réglées par toi dans Strava : seuils à 130, 150, 165, 180 bpm')
    expect(HEALTH_INFO.zones({ available: true, zones: null })).toBe('Pas de zones pour cette course')
    expect(HEALTH_INFO.zones({ available: false, zones: null })).toBe('Réservées aux abonnés Strava')
    expect(HEALTH_INFO.watchZones({ floors: [131, 145, 158, 172], low: 118 })).toBe('Seuils à 118, 131, 145, 158, 172 bpm')
    expect(HEALTH_INFO.watchZones({ floors: [131, 145, 158, 172], low: null })).toBe('Seuils à 131, 145, 158, 172 bpm')
    expect(HEALTH_INFO.watchZones(null)).toBe('Aucune zone réglée sur ta montre')
    expect(HEALTH_INFO.watchRunZones({ sec: [60, 600, 0, 0, 0] })).toBe('Temps par zone compté par ta montre')
    expect(HEALTH_INFO.watchRunZones({ sec: null })).toBe('Zones de la course, sans temps compté')
    expect(HEALTH_INFO.watchRunZones(null)).toBe('Pas de zones pour cette course')
    expect(HEALTH_INFO.records(5)).toBe('5 records')
    expect(HEALTH_INFO.ai()).toBe('Dernière demande réussie')
  })

  it('forme : ce qui est reçu, puis ce qui manque', () => {
    expect(HEALTH_INFO.forme({ vo2max: 52, status: {}, load: {}, predictions: {}, readiness: null, recoveryHours: null }))
      .toBe('VO2max, statut, charge, prédictions. Sans : préparation du jour, récupération')
    expect(HEALTH_INFO.forme({ vo2max: 52, status: {}, load: {}, predictions: {}, readiness: {}, recoveryHours: 14 }))
      .toBe('VO2max, statut, charge, prédictions, préparation du jour, récupération')
    expect(HEALTH_INFO.forme({})).toBe('Aucune donnée reçue')
  })
})

describe('diagnosticText', () => {
  const h = emptyHealth()
  h['strava.activities'] = markOk(h['strava.activities'], T1, '16 courses sur les 60 derniers jours')
  h['garmin.plan'] = markError(
    markOk(h['garmin.plan'], T1),
    T2,
    `Session refusée pour coureur.test@example.com, voir https://connect.example.com/session?id=123 ${'x'.repeat(300)}`,
    401,
  )
  const text = diagnosticText({
    version: '1.12.0',
    now: T2,
    connected: { strava: true, garmin: true, ai: false },
    aiProvider: 'gemini',
    health: h,
    userAgent: 'Mozilla/5.0 (iPhone) Safari/605.1',
  })

  it('version, date, comptes, une ligne par source, navigateur', () => {
    expect(text).toContain('Version : 1.12.0')
    expect(text).toContain(`Date : ${T2}`)
    expect(text).toContain('Strava : oui · Garmin : oui · IA : non')
    expect(text).toContain(`strava.activities : ok · essai ${T1} · réussite ${T1}`)
    expect(text).toContain('ai : compte non connecté')
    expect(text).toContain('strava.details : pas encore lu · essai jamais · réussite jamais')
    expect(text).toContain('Navigateur : Mozilla/5.0 (iPhone) Safari/605.1')
    for (const k of HEALTH_KEYS) expect(text).toContain(`${k} : `)
  })

  it('erreur : code, message coupé à 160 caractères, e-mail et URL masqués', () => {
    const line = text.split('\n').find((l) => l.startsWith('garmin.plan'))!
    expect(line).toContain(`échec · essai ${T2} · réussite ${T1} · code 401 · Session refusée pour [masqué], voir [masqué] xxx`)
    expect(text).not.toContain('example.com')
    expect(text).not.toContain('coureur.test')
    const msg = line.split(' · code 401 · ')[1]!
    expect(msg.length).toBe(160)
    expect(msg.endsWith('…')).toBe(true)
  })

  it('ni ce qui a été lu, ni noms de courses', () => {
    expect(text).not.toContain('16 courses')
  })

  it('maskPrivate', () => {
    expect(maskPrivate('écris à a.b+c@mail.example.be ou va sur www.example.org/aide.')).toBe('écris à [masqué] ou va sur [masqué]')
    expect(maskPrivate('Strava a refusé la requête (502)')).toBe('Strava a refusé la requête (502)')
  })
})
