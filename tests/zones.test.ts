import { describe, expect, it } from 'vitest'
import {
  estimateHrMax, garminAccountZones, garminRunZones, hrZones, maxHrZones, pickZones, reserveZones, sameZones, stravaDefaultFloors, stravaHrZones,
  timeInZones, validFloors, watchZonesHold, zoneNote, zoneOf, zoneRange, zoneSourceLine,
} from '../shared/utils/zones'

/** Zones d'un compte Strava inventé : zone 2 dès 124, zone 3 dès 154, zone 4 dès 169, zone 5 dès 184. */
const FLOORS = [124, 154, 169, 184]
/** Zones d'une montre inventée : zone 1 dès 118, puis 131, 145, 158 et 172. */
const WATCH = [131, 145, 158, 172]

/** Réponse de Strava pour une course (inventée) : tranches aux bornes partagées, la dernière ouverte (-1). */
const stravaReply = (times = [300, 1800, 240, 60, 0], custom = false) => [
  { type: 'pace', distribution_buckets: [{ min: 0, max: 2.1, time: 500 }] },
  {
    type: 'heartrate',
    sensor_based: true,
    custom_zones: custom,
    distribution_buckets: [
      { min: 0, max: 124, time: times[0] },
      { min: 124, max: 154, time: times[1] },
      { min: 154, max: 169, time: times[2] },
      { min: 169, max: 184, time: times[3] },
      { min: 184, max: -1, time: times[4] },
    ],
  },
]

/** Réponse de Garmin pour une activité (inventée) : une ligne par zone. */
const watchRunReply = (secs = [120.4, 1500, 600.6, 90, 0]) =>
  [118, ...WATCH].map((low, i) => ({ zoneNumber: i + 1, secsInZone: secs[i], zoneLowBoundary: low }))

/** Réponse de Garmin pour les zones du compte (inventée) : un profil général et un profil course à pied. */
const watchReply = () => [
  { sport: 'DEFAULT', trainingMethod: 'HR_MAX', maxHeartRateUsed: 190, restingHeartRateUsed: 50, zone1Floor: 95, zone2Floor: 114, zone3Floor: 133, zone4Floor: 152, zone5Floor: 171 },
  { sport: 'RUNNING', trainingMethod: 'HR_RESERVE', maxHeartRateUsed: 186, restingHeartRateUsed: 50, zone1Floor: 118, zone2Floor: 131, zone3Floor: 145, zone4Floor: 158, zone5Floor: 172 },
]

describe('zones calculées sur la FC max', () => {
  it('maxHrZones : 50–60–70–80–90–100 %', () => {
    expect(maxHrZones(190)).toEqual({ floors: [114, 133, 152, 171], low: 95, top: 190 })
  })

  it('hrZones : cinq zones aux bornes comprises, sans recouvrement', () => {
    expect(hrZones(maxHrZones(190))).toEqual([
      { z: 1, from: 95, to: 113, label: 'Très facile' },
      { z: 2, from: 114, to: 132, label: 'Endurance' },
      { z: 3, from: 133, to: 151, label: 'Tempo' },
      { z: 4, from: 152, to: 170, label: 'Seuil' },
      { z: 5, from: 171, to: 190, label: 'Maximum' },
    ])
  })

  it('le seuil affiché appartient à sa zone', () => {
    const { floors } = maxHrZones(192)
    // 60 % de 192 = 115,2 : la zone 2 est affichée « 115–133 », 115 y est donc compté
    expect(floors[0]).toBe(115)
    expect(zoneOf(114, floors)).toBe(1)
    expect(zoneOf(115, floors)).toBe(2)
  })

  it('estimateHrMax : la plus haute vue, au moins 3 courses avec cardio', () => {
    expect(estimateHrMax([{ maxHr: 181 }, { maxHr: 176 }, {}, { maxHr: 188 }])).toBe(188)
    expect(estimateHrMax([{ maxHr: 181 }, { maxHr: 0 }, {}])).toBeNull()
  })
})

describe('zones données par des seuils', () => {
  it('hrZones : sans bas ni haut connus, la zone 1 part de 0 et la zone 5 reste ouverte', () => {
    const rows = hrZones({ floors: FLOORS, low: null, top: null })
    expect(rows.map((r) => [r.from, r.to])).toEqual([[0, 123], [124, 153], [154, 168], [169, 183], [184, null]])
    expect(rows.map(zoneRange)).toEqual(['0–123', '124–153', '154–168', '169–183', '184+'])
    expect(hrZones({ floors: FLOORS, low: 0, top: null })).toEqual(rows)
  })

  it('hrZones : la montre donne un bas de zone 1, et ses zones portent les noms de Garmin', () => {
    expect(hrZones({ floors: WATCH, low: 118, top: null }).map(zoneRange)).toEqual(['118–130', '131–144', '145–157', '158–171', '172+'])
    expect(hrZones({ floors: WATCH, low: 118, top: 186 }).map(zoneRange)[4]).toBe('172–186')
    expect(hrZones({ floors: WATCH, low: 118, top: null }, 'garmin').map((z) => z.label)).toEqual(['Échauffement', 'Facile', 'Aérobie', 'Seuil', 'Maximum'])
    // Strava et le calcul gardent les noms de l'appli
    for (const from of ['strava', 'set', 'seen', null, undefined] as const) {
      expect(hrZones({ floors: FLOORS, low: null, top: null }, from).map((z) => z.label)).toEqual(['Très facile', 'Endurance', 'Tempo', 'Seuil', 'Maximum'])
    }
  })

  it('hrZones : un bas ou un haut incohérent n’est pas affiché', () => {
    const rows = hrZones({ floors: FLOORS, low: 130, top: 170 })
    expect(rows[0]).toMatchObject({ from: 0, to: 123 })
    expect(rows[4]).toMatchObject({ from: 184, to: null })
  })

  it('zoneOf : la zone la plus haute dont le seuil est atteint', () => {
    expect([0, 90, 123, 124, 153, 154, 168, 169, 183, 184, 210].map((hr) => zoneOf(hr, FLOORS))).toEqual([1, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5])
  })

  it('timeInZones : secondes par zone, sous le premier seuil compté en zone 1', () => {
    const stream = { t: [0, 10, 20, 30, 40, 50], hr: [80, 80, 80, 140, 140, 185] }
    expect(timeInZones(stream, maxHrZones(200).floors)).toEqual([20, 0, 20, 0, 10])
    expect(timeInZones(stream, FLOORS)).toEqual([20, 20, 0, 0, 10])
    expect(timeInZones({ t: [0, 10], hr: null }, FLOORS)).toBeNull()
    expect(timeInZones(stream, null)).toBeNull()
    expect(timeInZones(stream, [120, 150])).toBeNull()
  })

  it('timeInZones : sous le bas de la zone 1 de la montre, le temps n’est dans aucune zone', () => {
    const stream = { t: [0, 60, 120, 180, 240], hr: [100, 110, 125, 140, 150] }
    // 110 < 118 : hors zones ; 125 en zone 1 ; 140 en zone 2 ; 150 en zone 3
    expect(timeInZones(stream, WATCH, 118)).toEqual([60, 60, 60, 0, 0])
    expect(timeInZones(stream, WATCH)).toEqual([120, 60, 60, 0, 0])
    // Tout sous la zone 1 : cinq zéros (il y a bien du cardio), pas null
    expect(timeInZones({ t: [0, 60], hr: [90, 95] }, WATCH, 118)).toEqual([0, 0, 0, 0, 0])
  })

  it('un même footing change de zone selon le découpage', () => {
    // 30 minutes à 140 bpm : « Tempo » avec 50–60–70–80–90 % de 190, « Endurance » pour la montre et pour Strava
    const jog = { t: [0, 900, 1800], hr: [140, 140, 140] }
    expect(timeInZones(jog, maxHrZones(190).floors)).toEqual([0, 0, 1800, 0, 0])
    expect(timeInZones(jog, FLOORS)).toEqual([0, 1800, 0, 0, 0])
    expect(timeInZones(jog, WATCH)).toEqual([0, 1800, 0, 0, 0])
  })

  it('validFloors : quatre seuils croissants et plausibles', () => {
    expect(validFloors([124.4, 154, 169, 184])).toEqual(FLOORS)
    expect(validFloors([124, 154, 169])).toBeNull()
    expect(validFloors([124, 124, 169, 184])).toBeNull()
    expect(validFloors([154, 124, 169, 184])).toBeNull()
    expect(validFloors([0, 154, 169, 184])).toBeNull()
    expect(validFloors([124, 154, 169, 400])).toBeNull()
    expect(validFloors([124, '154', 169, 184])).toBeNull()
    expect(validFloors(null)).toBeNull()
  })

  it('zones de démo : Strava par défaut, et montre réglée sur la FC de réserve', () => {
    expect(stravaDefaultFloors(190)).toEqual([124, 154, 169, 184])
    expect(reserveZones(186, 52)).toEqual({ floors: [132, 146, 159, 173], low: 119, top: 186, method: 'reserve' })
  })
})

describe('stravaHrZones : lecture de la réponse de Strava', () => {
  it('seuils (le « min » de chaque tranche) et temps comptés par Strava', () => {
    expect(stravaHrZones(stravaReply())).toEqual({ floors: FLOORS, low: null, sec: [300, 1800, 240, 60, 0], custom: false })
    expect(stravaHrZones(stravaReply([0, 10, 0, 0, 0], true))).toEqual({ floors: FLOORS, low: null, sec: [0, 10, 0, 0, 0], custom: true })
  })

  it('tranches dans le désordre, ou aux bornes séparées (0–123, 124–153…) : mêmes seuils', () => {
    const reply = stravaReply()
    const hr = reply[1]!
    hr.distribution_buckets = [...hr.distribution_buckets].reverse()
    expect(stravaHrZones(reply)?.floors).toEqual(FLOORS)
    expect(stravaHrZones(reply)?.sec).toEqual([300, 1800, 240, 60, 0])
    const apart = [{ type: 'heartrate', distribution_buckets: [[0, 123], [124, 153], [154, 168], [169, 183], [184, -1]].map(([min, max]) => ({ min, max, time: 60 })) }]
    expect(stravaHrZones(apart)?.floors).toEqual(FLOORS)
  })

  it('sans temps compté : les seuils seulement, le temps sera compté sur la courbe', () => {
    expect(stravaHrZones(stravaReply([0, 0, 0, 0, 0]))).toEqual({ floors: FLOORS, low: null, sec: null, custom: false })
    const noTime = [{ type: 'heartrate', distribution_buckets: [0, 124, 154, 169, 184].map((min) => ({ min, max: -1 })) }]
    expect(stravaHrZones(noTime)).toEqual({ floors: FLOORS, low: null, sec: null, custom: false })
  })

  it('réponse inattendue : rien n’est retenu', () => {
    expect(stravaHrZones(null)).toBeNull()
    expect(stravaHrZones({})).toBeNull()
    expect(stravaHrZones([])).toBeNull()
    expect(stravaHrZones([{ type: 'power', distribution_buckets: [] }])).toBeNull()
    expect(stravaHrZones([{ type: 'heartrate' }])).toBeNull()
    // Quatre tranches seulement
    expect(stravaHrZones([{ type: 'heartrate', distribution_buckets: [0, 124, 154, 169].map((min) => ({ min, max: -1, time: 5 })) }])).toBeNull()
    // Seuils qui ne montent pas
    expect(stravaHrZones([{ type: 'heartrate', distribution_buckets: [0, 124, 124, 169, 184].map((min) => ({ min, max: -1, time: 5 })) }])).toBeNull()
    // Tranches de puissance rangées sous « heartrate » par erreur (0–50–100…) : seuils invraisemblables
    expect(stravaHrZones([{ type: 'heartrate', distribution_buckets: [0, 5, 10, 15, 20].map((min) => ({ min, max: -1, time: 5 })) }])).toBeNull()
  })
})

describe('lecture des réponses de Garmin', () => {
  it('garminAccountZones : le profil course à pied d’abord, avec sa méthode', () => {
    expect(garminAccountZones(watchReply())).toEqual({ floors: WATCH, low: 118, top: 186, method: 'reserve' })
  })

  it('garminAccountZones : sans profil course à pied, le profil général ; sinon le premier lisible', () => {
    const [general, running] = watchReply()
    expect(garminAccountZones([general])).toEqual({ floors: [114, 133, 152, 171], low: 95, top: 190, method: 'max' })
    expect(garminAccountZones([{ ...running, sport: 'CYCLING', trainingMethod: 'LACTATE_THRESHOLD' }])).toMatchObject({ floors: WATCH, method: 'lthr' })
    // Un profil course à pied abîmé ne cache pas le profil général
    expect(garminAccountZones([general, { ...running, zone3Floor: null }])?.floors).toEqual([114, 133, 152, 171])
    // Un seul objet au lieu d'une liste
    expect(garminAccountZones(running)?.floors).toEqual(WATCH)
  })

  it('garminAccountZones : méthode inconnue, bas ou haut incohérent : gardé sans eux', () => {
    const [, running] = watchReply()
    expect(garminAccountZones([{ ...running, trainingMethod: 'AUTRE', zone1Floor: 140, maxHeartRateUsed: 150 }])).toEqual({ floors: WATCH, low: null, top: null, method: null })
  })

  it('garminAccountZones : réponse inattendue, rien n’est retenu', () => {
    expect(garminAccountZones(null)).toBeNull()
    expect(garminAccountZones([])).toBeNull()
    expect(garminAccountZones('zones')).toBeNull()
    expect(garminAccountZones([{ sport: 'RUNNING' }])).toBeNull()
    expect(garminAccountZones([{ sport: 'RUNNING', zone2Floor: 150, zone3Floor: 140, zone4Floor: 160, zone5Floor: 170 }])).toBeNull()
  })

  it('garminRunZones : les seuils de la montre pour la course, et le temps qu’elle a compté', () => {
    expect(garminRunZones(watchRunReply())).toEqual({ floors: WATCH, low: 118, sec: [120, 1500, 601, 90, 0], custom: false })
    // Lignes dans le désordre
    expect(garminRunZones([...watchRunReply()].reverse())?.floors).toEqual(WATCH)
    // Sans aucun temps compté : les seuils seulement
    expect(garminRunZones(watchRunReply([0, 0, 0, 0, 0]))).toEqual({ floors: WATCH, low: 118, sec: null, custom: false })
  })

  it('garminRunZones : réponse inattendue, rien n’est retenu', () => {
    expect(garminRunZones(null)).toBeNull()
    expect(garminRunZones([])).toBeNull()
    expect(garminRunZones({ zones: watchRunReply() })).toBeNull()
    expect(garminRunZones(watchRunReply().slice(0, 4))).toBeNull()
    // Zones numérotées autrement que de 1 à 5
    expect(garminRunZones(watchRunReply().map((r) => ({ ...r, zoneNumber: r.zoneNumber + 1 })))).toBeNull()
    // Champs renommés
    expect(garminRunZones(watchRunReply().map((r) => ({ zone: r.zoneNumber, low: r.zoneLowBoundary, secs: r.secsInZone })))).toBeNull()
  })
})

describe('pickZones : quelles zones afficher', () => {
  /** Rien n'a changé depuis la course : une seule lecture */
  const SAME = { changed: false, view: 'current' as const }
  const strava = { floors: FLOORS, low: null, sec: [300, 1800, 240, 60, 0], custom: false }
  const watch = { floors: WATCH, low: 118, sec: [120, 1500, 601, 90, 0], custom: false }
  const stravaAccount = { floors: [120, 150, 165, 180], off: false }
  const watchAccount = { floors: [130, 144, 157, 171], low: 117, top: 185, off: false }

  it('source montre : les zones de la course lues chez Garmin, et le temps compté par la montre', () => {
    // La montre a aujourd'hui les mêmes zones que le jour de la course
    const unchanged = { floors: WATCH, low: 118, top: 186, off: false }
    expect(pickZones({ source: 'garmin', garminOn: true, runs: { garmin: watch, strava }, accounts: { garmin: unchanged, strava: stravaAccount }, hrMax: 188, estimated: 192 })).toEqual({
      set: { floors: WATCH, low: 118, top: null }, sec: [120, 1500, 601, 90, 0], from: 'garmin', maxHr: null, wanted: 'garmin', why: null, ...SAME,
    })
  })

  it('source montre, course pas lue chez Garmin : les zones réglées sur la montre, avant celles de Strava', () => {
    expect(pickZones({ source: 'garmin', garminOn: true, runs: { garmin: null, strava }, accounts: { garmin: watchAccount, strava: stravaAccount }, hrMax: null, estimated: 192 })).toEqual({
      set: { floors: [130, 144, 157, 171], low: 117, top: 185 }, sec: null, from: 'garmin', maxHr: null, wanted: 'garmin', why: null, ...SAME,
    })
  })

  it('source montre sans rien de Garmin : celles de Strava, en disant pourquoi', () => {
    const unread = pickZones({ source: 'garmin', garminOn: true, runs: { strava }, accounts: {}, hrMax: null, estimated: 192 })
    expect(unread).toMatchObject({ from: 'strava', wanted: 'garmin', why: 'wait', sec: [300, 1800, 240, 60, 0] })
    expect(unread.set).toEqual({ floors: FLOORS, low: null, top: null })
    expect(pickZones({ source: 'garmin', garminOn: false, runs: { strava }, accounts: {}, hrMax: null, estimated: 192 })).toMatchObject({ from: 'strava', why: 'unlinked' })
    // Ni montre ni Strava : le calcul
    expect(pickZones({ source: 'garmin', garminOn: true, runs: {}, accounts: {}, hrMax: null, estimated: 190 })).toEqual({
      set: maxHrZones(190), sec: null, from: 'seen', maxHr: 190, wanted: 'garmin', why: 'wait', ...SAME,
    })
  })

  it('source Strava : jamais la montre, même si ses zones sont connues', () => {
    expect(pickZones({ source: 'strava', garminOn: true, runs: { garmin: watch, strava }, accounts: { garmin: watchAccount }, hrMax: 188, estimated: 192 })).toEqual({
      set: { floors: FLOORS, low: null, top: null }, sec: [300, 1800, 240, 60, 0], from: 'strava', maxHr: null, wanted: 'strava', why: null, ...SAME,
    })
    // Course pas lue : les derniers seuils connus du compte, temps à compter sur la courbe
    expect(pickZones({ source: 'strava', runs: { strava: null }, accounts: { strava: stravaAccount }, hrMax: null, estimated: 192 })).toMatchObject({
      set: { floors: [120, 150, 165, 180], low: null, top: null }, sec: null, from: 'strava',
    })
    // Des seuils abîmés dans l'état gardé ne sont pas utilisés
    expect(pickZones({ source: 'strava', runs: { strava: { floors: [1, 2], low: null, sec: null, custom: false } }, accounts: { strava: stravaAccount }, hrMax: null, estimated: 192 }).set?.floors).toEqual([120, 150, 165, 180])
  })

  it('source Strava sans zones : calcul sur la FC max, en disant pourquoi', () => {
    expect(pickZones({ source: 'strava', runs: {}, accounts: {}, hrMax: null, estimated: 190 })).toEqual({ set: maxHrZones(190), sec: null, from: 'seen', maxHr: 190, wanted: 'strava', why: 'wait', ...SAME })
    expect(pickZones({ source: 'strava', runs: {}, accounts: { strava: { floors: null, off: true } }, hrMax: 186, estimated: 190 })).toEqual({
      set: maxHrZones(186), sec: null, from: 'set', maxHr: 186, wanted: 'strava', why: 'off', ...SAME,
    })
    // Abonnement arrêté mais seuils déjà connus : on les garde
    expect(pickZones({ source: 'strava', runs: {}, accounts: { strava: { floors: FLOORS, off: true } }, hrMax: null, estimated: 190 }).from).toBe('strava')
  })

  it('source FC max : toujours le calcul, même si d’autres zones sont connues', () => {
    expect(pickZones({ source: 'fcmax', runs: { garmin: watch, strava }, accounts: { garmin: watchAccount, strava: stravaAccount }, hrMax: null, estimated: 190 })).toEqual({
      set: maxHrZones(190), sec: null, from: 'seen', maxHr: 190, wanted: 'fcmax', why: null, ...SAME,
    })
    expect(pickZones({ source: 'fcmax', hrMax: 184, estimated: 190 })).toMatchObject({ from: 'set', maxHr: 184 })
  })

  it('zones changées depuis la course : celles d’aujourd’hui par défaut, celles du jour à la demande', () => {
    // Réglages lus aujourd'hui sur la montre (« live »), qui ne sont plus ceux du jour de la course
    const today = { floors: [126, 141, 155, 169], low: 112, top: 185, off: false, live: true }
    const input = { source: 'garmin' as const, garminOn: true, forRun: true, runs: { garmin: watch }, accounts: { garmin: today }, hrMax: null, estimated: 192 }
    // Par défaut : les zones actuelles de la montre, temps à recompter sur la courbe, zone 5 sans haut
    expect(pickZones(input)).toEqual({
      set: { floors: [126, 141, 155, 169], low: 112, top: null }, sec: null, from: 'garmin', maxHr: null, wanted: 'garmin', why: null, changed: true, view: 'current',
    })
    // À la demande : celles du jour, avec le temps compté par la montre
    expect(pickZones({ ...input, view: 'day' })).toEqual({
      set: { floors: WATCH, low: 118, top: null }, sec: [120, 1500, 601, 90, 0], from: 'garmin', maxHr: null, wanted: 'garmin', why: null, changed: true, view: 'day',
    })
    // Mêmes zones qu'aujourd'hui, à un battement près : rien à choisir, la course garde ses zones et le temps de la montre
    const same = pickZones({ ...input, view: 'day', accounts: { garmin: { ...watchAccount, live: true } } })
    expect(same).toMatchObject({ changed: false, view: 'current', set: { floors: WATCH, low: 118 }, sec: [120, 1500, 601, 90, 0] })
    // Zones du compte déduites d'une course, ou contredites par la dernière course (pas « live ») : la course garde les siennes
    const unsure = pickZones({ ...input, accounts: { garmin: { ...today, live: false } } })
    expect(unsure).toMatchObject({ changed: false, view: 'current', set: { floors: WATCH, low: 118 }, sec: [120, 1500, 601, 90, 0] })
    // Strava ne donne ses zones qu'avec une course : rien ne dit que celles du compte sont d'aujourd'hui
    const viaStrava = pickZones({ source: 'strava', forRun: true, runs: { strava }, accounts: { strava: stravaAccount }, hrMax: null, estimated: 192 })
    expect(viaStrava).toMatchObject({ from: 'strava', changed: false, set: { floors: FLOORS }, sec: [300, 1800, 240, 60, 0] })
    // La montre voulue mais illisible, Strava en secours : les zones de la course chez Strava, sans choix
    const fallback = pickZones({ source: 'garmin', garminOn: true, forRun: true, runs: { strava }, accounts: { strava: stravaAccount }, hrMax: null, estimated: 192 })
    expect(fallback).toMatchObject({ from: 'strava', changed: false, set: { floors: FLOORS } })
  })

  it('sameZones : mêmes zones, au battement près', () => {
    expect(sameZones({ floors: WATCH, low: 118 }, { floors: [...WATCH], low: 118 })).toBe(true)
    // Un battement d'écart (un arrondi) ne fait pas un changement de réglage
    expect(sameZones({ floors: WATCH, low: 118 }, { floors: [130, 146, 158, 171], low: 119 })).toBe(true)
    expect(sameZones({ floors: WATCH, low: 118 }, { floors: [131, 145, 158, 174], low: 118 })).toBe(false)
    expect(sameZones({ floors: WATCH, low: 118 }, { floors: WATCH, low: 120 })).toBe(false)
    // Bas de zone 1 inconnu d'un côté : seuls les seuils comptent
    expect(sameZones({ floors: WATCH, low: 118 }, { floors: WATCH, low: null })).toBe(true)
    expect(sameZones({ floors: WATCH, low: 118 }, { floors: WATCH.slice(1), low: 118 })).toBe(false)
  })

  it('watchZonesHold : la course la plus récente fait foi', () => {
    const account = { floors: WATCH, low: 118, since: '2026-03-10T08:00:00Z' }
    const other = { floors: [126, 141, 155, 169], low: 112 }
    // Aucune course lue chez Garmin : rien ne contredit les réglages
    expect(watchZonesHold(account, null)).toBe(true)
    // Course d'avant la lecture de ces réglages : d'autres zones, c'est justement un changement
    expect(watchZonesHold(account, { startedAt: '2026-03-09T17:00:00Z', zones: other })).toBe(true)
    // Course d'après : elle doit porter les mêmes zones, au battement près
    expect(watchZonesHold(account, { startedAt: '2026-03-11T17:00:00Z', zones: { floors: [130, 145, 159, 172], low: 118 } })).toBe(true)
    expect(watchZonesHold(account, { startedAt: '2026-03-11T17:00:00Z', zones: other })).toBe(false)
    // Date illisible : pas de quoi contredire
    expect(watchZonesHold({ ...account, since: '' }, { startedAt: '2026-03-11T17:00:00Z', zones: other })).toBe(true)
  })

  it('ni zones ni FC max : rien à afficher', () => {
    expect(pickZones({ source: 'strava', hrMax: null, estimated: null })).toEqual({ set: null, sec: null, from: null, maxHr: null, wanted: 'strava', why: 'wait', ...SAME })
    expect(pickZones({ source: 'fcmax', hrMax: 0, estimated: undefined })).toEqual({ set: null, sec: null, from: null, maxHr: null, wanted: 'fcmax', why: null, ...SAME })
  })
})

describe('phrases : d’où viennent les zones', () => {
  const base = { set: { floors: FLOORS, low: null, top: null }, sec: null, maxHr: null, changed: false, view: 'current' as const }
  const computed = { set: maxHrZones(190), sec: null, maxHr: 190, changed: false, view: 'current' as const }

  it('zoneNote : sous le cardio d’une course', () => {
    expect(zoneNote({ ...base, from: 'garmin', wanted: 'garmin', why: null })).toBe('Ce sont les zones de ta montre Garmin.')
    expect(zoneNote({ ...base, from: 'strava', wanted: 'strava', why: null })).toBe('Ce sont les zones de ton compte Strava.')
    expect(zoneNote({ ...base, from: 'strava', wanted: 'garmin', why: 'wait' })).toBe('Les zones de ta montre n’ont pas pu être lues : ce sont celles de ton compte Strava.')
    expect(zoneNote({ ...base, from: 'strava', wanted: 'garmin', why: 'unlinked' })).toBe('Garmin n’est pas connecté : ce sont celles de ton compte Strava.')
    expect(zoneNote({ ...computed, from: 'seen', wanted: 'fcmax', why: null })).toBe('Zones calculées sur une FC max de 190 bpm (la plus haute vue sur tes courses).')
    expect(zoneNote({ ...computed, from: 'set', wanted: 'fcmax', why: null })).toBe('Zones calculées sur une FC max de 190 bpm (celle que tu as saisie).')
    expect(zoneNote({ ...computed, from: 'seen', wanted: 'garmin', why: 'wait' })).toBe('Les zones de ta montre n’ont pas pu être lues : tes zones sont calculées sur une FC max de 190 bpm (la plus haute vue sur tes courses).')
    expect(zoneNote({ ...computed, from: 'seen', wanted: 'strava', why: 'off' })).toBe('Strava ne donne tes zones qu’à ses abonnés : tes zones sont calculées sur une FC max de 190 bpm (la plus haute vue sur tes courses).')
    expect(zoneNote({ ...computed, from: 'set', wanted: 'strava', why: 'wait' })).toBe('Tes zones Strava n’ont pas pu être lues : tes zones sont calculées sur une FC max de 190 bpm (celle que tu as saisie).')
    expect(zoneNote({ set: null, sec: null, maxHr: null, from: null, wanted: 'garmin', why: 'wait', changed: false, view: 'current' })).toBe('Il faut au moins trois courses avec cardio pour calculer tes zones.')
  })

  it('zoneNote : course courue avant un changement de zones', () => {
    expect(zoneNote({ ...base, from: 'garmin', wanted: 'garmin', why: null, changed: true, view: 'current' })).toBe(
      'Tes zones ont changé depuis cette course : elle est relue avec celles d’aujourd’hui, et le temps est recompté sur ta courbe.',
    )
    expect(zoneNote({ ...base, from: 'garmin', wanted: 'garmin', why: null, changed: true, view: 'day' })).toBe('Ce sont les zones que ta montre avait ce jour-là, comme dans Garmin Connect.')
  })

  it('zoneSourceLine : dans les réglages', () => {
    expect(zoneSourceLine({ ...base, from: 'garmin', wanted: 'garmin', why: null }, { method: 'reserve' })).toBe(
      'Ce sont les zones de ta montre Garmin, réglées en % de ta FC de réserve. Pour les changer, c’est sur ta montre ou dans Garmin Connect.',
    )
    expect(zoneSourceLine({ ...base, from: 'garmin', wanted: 'garmin', why: null })).toBe('Ce sont les zones de ta montre Garmin. Pour les changer, c’est sur ta montre ou dans Garmin Connect.')
    expect(zoneSourceLine({ ...base, from: 'strava', wanted: 'strava', why: null }, { custom: true })).toBe(
      'Ce sont les zones de ton compte Strava, réglées par toi. Pour les changer, c’est dans les réglages de Strava.',
    )
    expect(zoneSourceLine({ ...computed, from: 'seen', wanted: 'fcmax', why: null })).toBe('De 50 à 100 % de ta FC max, par tranches de 10 % : le découpage par défaut de la plupart des montres.')
    // La montre voulue mais pas lue
    expect(zoneSourceLine({ ...base, from: 'strava', wanted: 'garmin', why: 'unlinked' })).toBe('Connecte Garmin pour lire les zones de ta montre. En attendant, voici celles de ton compte Strava.')
    expect(zoneSourceLine({ ...computed, from: 'seen', wanted: 'garmin', why: 'wait' }, { reading: true })).toBe('Lecture des zones de ta montre… En attendant, elles sont calculées sur ta FC max.')
    expect(zoneSourceLine({ ...computed, from: 'seen', wanted: 'garmin', why: 'wait' })).toBe('Les zones de ta montre n’ont pas pu être lues. En attendant, elles sont calculées sur ta FC max.')
    // Strava voulu mais pas lu
    expect(zoneSourceLine({ ...computed, from: 'seen', wanted: 'strava', why: 'off' })).toBe('Strava ne donne tes zones qu’à ses abonnés. En attendant, elles sont calculées sur ta FC max.')
    expect(zoneSourceLine({ ...computed, from: 'seen', wanted: 'strava', why: 'wait' })).toBe('Tes zones Strava seront lues à l’ouverture d’une course. En attendant, elles sont calculées sur ta FC max.')
    expect(zoneSourceLine({ set: null, sec: null, maxHr: null, from: null, wanted: 'strava', why: 'wait', changed: false, view: 'current' }, { reading: true })).toBe('Lecture de tes zones Strava…')
  })
})
