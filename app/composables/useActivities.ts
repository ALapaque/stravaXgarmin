/*
 * Données fictives en attendant les vraies API.
 * Strava : GET /athlete/activities + webhook « activity create », PUT /activities/{id}.
 * Garmin : Activity API (lecture seule, accès développeur à demander).
 */

export type RunType = 'long' | 'interval' | 'recovery' | 'tempo'
export type EffortKey = '5k' | '10k' | 'half'
export type ChangeSource = 'garmin' | 'regle' | 'ia' | 'manuel' | 'record' | 'description' | 'strava'

export interface Weather {
  tempC: number
  sky: string
  windKmh: number
}

export interface Activity {
  id: string
  type: RunType
  startedAt: string
  place: string
  distanceKm: number
  durationSec: number
  avgHr: number
  elevationM: number
  /** Temps de chaque kilomètre complet, en secondes */
  splits: number[]
  weather?: Weather
  shoe?: Shoe
  /** Meilleurs efforts dans la course (Strava les calcule : best_efforts) */
  bestEfforts: Partial<Record<EffortKey, number>>
  garminName: string
  stravaName: string
  stravaDescription?: string
  /** Identifiants réels quand les données viennent des API (absents en mode démo) */
  stravaId?: number
  garminId?: number
}

export interface Shoe {
  name: string
  km: number
}

export const RUN_TYPES: Record<RunType, { label: string; color: string }> = {
  long: { label: 'Sortie longue', color: 'var(--type-long)' },
  interval: { label: 'Fractionné', color: 'var(--type-interval)' },
  recovery: { label: 'Récupération', color: 'var(--type-recovery)' },
  tempo: { label: 'Tempo', color: 'var(--type-tempo)' },
}

export const SHOES: Record<'peg' | 'vf', Shoe> = {
  peg: { name: 'Nike Pegasus 41', km: 612 },
  vf: { name: 'Nike Vaporfly 3', km: 188 },
}

/** Date du jour à Bruxelles (AAAA-MM-JJ). Les données de démo sont datées autour du 18 novembre 2026. */
export const TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Brussels' }).format(new Date())

/* ───── Générateur déterministe pour l'historique d'octobre-novembre ───── */

function prng(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function makeSplits(paceSec: number, km: number, rand: () => number, spread = 10) {
  return Array.from({ length: Math.floor(km) }, () => Math.round(paceSec + (rand() - 0.5) * spread * 2))
}

const SKIES = ['ensoleillé', 'nuageux', 'couvert', 'pluie fine', 'brouillard']

function generateHistory(): Activity[] {
  const rand = prng(42)
  const runs: Activity[] = []
  const plan: Record<number, RunType> = { 2: 'interval', 4: 'recovery', 6: 'tempo', 0: 'long' }
  const places: Record<RunType, string[]> = {
    interval: ['piste'],
    recovery: ['route', 'bois'],
    tempo: ['route', 'quais'],
    long: ['chemins', 'bois', 'quais'],
  }
  for (let d = new Date('2026-10-01T12:00:00Z'); d <= new Date('2026-11-11T12:00:00Z'); d.setUTCDate(d.getUTCDate() + 1)) {
    const day = d.getUTCDay()
    const type = plan[day]
    if (!type || rand() < 0.15) continue
    const date = d.toISOString().slice(0, 10)
    if (date === '2026-11-10') continue // tempo record déjà dans les données fixes

    const km = Math.round(
      ({ interval: 7 + rand() * 2, recovery: 5 + rand() * 2, tempo: 5 + rand() * 3, long: 12 + rand() * 6 })[type] * 10,
    ) / 10
    const pace = Math.round(({ interval: 316, recovery: 338, tempo: 292, long: 320 })[type] + rand() * 14)
    const efforts: Activity['bestEfforts'] = {}
    if (km >= 5) efforts['5k'] = Math.round(pace * 5 - (type === 'tempo' ? 0 : -20))
    if (km >= 10) efforts['10k'] = Math.round(pace * 10)
    const hour = type === 'long' ? 9 : type === 'recovery' ? 7 : 18
    const label = { interval: 'Fractionné piste', recovery: 'Footing récup', tempo: `Tempo ${Math.round(km)} km`, long: 'Sortie longue' }[type]
    const name = type === 'interval' ? `${label} ${rand() < 0.5 ? '10×400' : '6×800'}` : label
    runs.push({
      id: `h-${date}`,
      type,
      startedAt: `${date}T${String(hour).padStart(2, '0')}:${String(Math.floor(rand() * 50)).padStart(2, '0')}:00+01:00`,
      place: places[type][Math.floor(rand() * places[type].length)]!,
      distanceKm: km,
      durationSec: Math.round(pace * km),
      avgHr: Math.round(({ interval: 166, recovery: 135, tempo: 170, long: 147 })[type] + rand() * 6),
      elevationM: Math.round(type === 'interval' ? 5 : 30 + rand() * 140),
      splits: makeSplits(pace, km, rand),
      weather: { tempC: Math.round(6 + rand() * 9), sky: SKIES[Math.floor(rand() * SKIES.length)]!, windKmh: Math.round(5 + rand() * 20) },
      shoe: type === 'tempo' || type === 'interval' ? SHOES.vf : SHOES.peg,
      bestEfforts: efforts,
      garminName: name,
      stravaName: name,
    })
  }
  // L'ancien record sur 5 km, battu le 10 novembre
  const oldBest = runs.find((r) => r.type === 'tempo')
  if (oldBest) oldBest.bestEfforts['5k'] = 1438
  return runs
}

const rand = prng(7)

const RECENT: Activity[] = [
  {
    id: 'a2',
    type: 'interval',
    startedAt: '2026-11-17T18:42:00+01:00',
    place: 'piste',
    distanceKm: 8.0,
    durationSec: 2550,
    avgHr: 168,
    elevationM: 4,
    splits: [312, 330, 309, 334, 314, 328, 316, 332],
    weather: { tempC: 9, sky: 'pluie fine', windKmh: 20 },
    shoe: SHOES.vf,
    bestEfforts: { '5k': 1590 },
    garminName: 'Fractionné piste 10×400',
    stravaName: 'Morning Run',
  },
  {
    id: 'a3',
    type: 'recovery',
    startedAt: '2026-11-16T07:15:00+01:00',
    place: 'route',
    distanceKm: 6.2,
    durationSec: 2101,
    avgHr: 136,
    elevationM: 42,
    splits: makeSplits(339, 6.2, rand),
    weather: { tempC: 6, sky: 'brouillard', windKmh: 8 },
    shoe: SHOES.peg,
    bestEfforts: { '5k': 1690 },
    garminName: 'Footing récup',
    stravaName: 'Footing récup',
  },
  {
    id: 'a1',
    type: 'long',
    startedAt: '2026-11-15T09:30:00+01:00',
    place: 'chemins',
    distanceKm: 12.4,
    durationSec: 3912,
    avgHr: 148,
    elevationM: 168,
    splits: makeSplits(315, 12.4, rand),
    weather: { tempC: 11, sky: 'ensoleillé', windKmh: 12 },
    shoe: SHOES.peg,
    bestEfforts: { '5k': 1560, '10k': 3130 },
    garminName: 'Sortie longue',
    stravaName: 'Sortie longue',
  },
  {
    id: 'a4',
    type: 'tempo',
    startedAt: '2026-11-10T17:05:00+01:00',
    place: 'route',
    distanceKm: 5.0,
    durationSec: 1405,
    avgHr: 171,
    elevationM: 18,
    splits: [283, 280, 282, 279, 281],
    weather: { tempC: 8, sky: 'nuageux', windKmh: 14 },
    shoe: SHOES.vf,
    bestEfforts: { '5k': 1405 },
    garminName: 'Tempo 5 km',
    stravaName: 'Afternoon Run',
  },
]

export const demoActivities = (): Activity[] =>
  [...RECENT, ...generateHistory()].sort((a, b) => b.startedAt.localeCompare(a.startedAt))

export function useActivities() {
  const activities = useState<Activity[]>('activities', () => (isDemoCookie() ? demoActivities() : []))

  const byId = (id: string) => activities.value.find((a) => a.id === id)
  const isSynced = (a: Activity) => a.garminName === a.stravaName
  const toReview = computed(() => activities.value.filter((a) => !isSynced(a)))
  const sorted = computed(() => [...activities.value].sort((a, b) => b.startedAt.localeCompare(a.startedAt)))

  /** Les 7 derniers jours, aujourd'hui compris, pour l'histogramme de l'accueil. */
  const lastWeek = computed(() => {
    const days = lastDays(7)
    const runs = activities.value.filter((a) => days.some((d) => d.key === a.startedAt.slice(0, 10)))
    return {
      days: days.map((d) => ({
        ...d,
        km: runs.filter((a) => a.startedAt.slice(0, 10) === d.key).reduce((s, a) => s + a.distanceKm, 0),
      })),
      km: runs.reduce((s, a) => s + a.distanceKm, 0),
      sec: runs.reduce((s, a) => s + a.durationSec, 0),
      count: runs.length,
      synced: runs.filter(isSynced).length,
    }
  })

  /** Change le nom sur Strava (et l'envoie à l'API en mode réel), avec trace pour annuler. */
  async function setStravaName(id: string, name: string, source: ChangeSource) {
    const a = byId(id)
    if (!a || a.stravaName === name) return true
    const before = a.stravaName
    a.stravaName = name
    if (!(await pushField(a, 'name', name))) {
      a.stravaName = before
      return false
    }
    useHistory().record({ activityId: id, field: 'name', before, after: name, source })
    return true
  }

  async function setStravaDescription(id: string, text: string, source: ChangeSource = 'description') {
    const a = byId(id)
    if (!a || a.stravaDescription === text) return true
    const before = a.stravaDescription ?? ''
    a.stravaDescription = text
    if (!(await pushField(a, 'description', text))) {
      a.stravaDescription = before || undefined
      return false
    }
    useHistory().record({ activityId: id, field: 'description', before, after: text, source })
    return true
  }

  /** Renomme l'activité dans Garmin Connect (option, API non officielle). */
  async function setGarminName(id: string, name: string, source: ChangeSource) {
    const a = byId(id)
    if (!a || a.garminName === name) return true
    const before = a.garminName
    a.garminName = name
    if (!(await pushField(a, 'garminName', name))) {
      a.garminName = before
      return false
    }
    useHistory().record({ activityId: id, field: 'garminName', before, after: name, source })
    return true
  }

  return { activities, sorted, byId, isSynced, toReview, lastWeek, setStravaName, setStravaDescription, setGarminName }
}

/** Les n derniers jours jusqu'à TODAY inclus, du plus ancien au plus récent. */
export function lastDays(n: number) {
  const end = new Date(`${TODAY}T12:00:00Z`)
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(end)
    d.setUTCDate(end.getUTCDate() - (n - 1 - i))
    return {
      key: d.toISOString().slice(0, 10),
      letter: new Intl.DateTimeFormat('fr-BE', { weekday: 'narrow', timeZone: 'UTC' }).format(d),
    }
  })
}

/**
 * Envoie une modification à Strava ou Garmin quand l'activité vient des API.
 * En mode démo (pas d'identifiant), ne fait rien et réussit toujours.
 */
export async function pushField(a: Activity, field: 'name' | 'description' | 'garminName', value: string) {
  try {
    if (field === 'garminName') {
      if (!a.garminId) return true
      await $fetch(`/api/garmin/activities/${a.garminId}`, { method: 'PUT', body: { name: value } })
    } else {
      if (!a.stravaId) return true
      await $fetch(`/api/strava/activities/${a.stravaId}`, { method: 'PUT', body: { [field]: value } })
    }
    return true
  } catch (e) {
    const msg = (e as { statusMessage?: string; data?: { statusMessage?: string } }).data?.statusMessage
    useToast().show(msg ?? (field === 'garminName' ? 'Garmin a refusé la modification' : 'Strava a refusé la modification'))
    return false
  }
}

/** Le cookie de démo est lisible côté serveur : pas de flash entre démo et état vide. */
export const DEMO_COOKIE = 'sxg-demo'
export function isDemoCookie() {
  return useCookie<boolean>(DEMO_COOKIE).value === true
}
