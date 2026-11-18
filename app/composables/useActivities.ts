/*
 * Données fictives en attendant les vraies API.
 * Strava : GET /athlete/activities + webhook « activity create ».
 * Garmin : Activity API (accès développeur à demander).
 */

export type RunType = 'long' | 'interval' | 'recovery' | 'tempo'

export interface Activity {
  id: string
  type: RunType
  startedAt: string
  place: string
  distanceKm: number
  durationSec: number
  avgHr: number
  garminName: string
  stravaName: string
  stravaDescription?: string
}

export const RUN_TYPES: Record<RunType, { label: string; color: string }> = {
  long: { label: 'Sortie longue', color: 'var(--type-long)' },
  interval: { label: 'Fractionné', color: 'var(--type-interval)' },
  recovery: { label: 'Récupération', color: 'var(--type-recovery)' },
  tempo: { label: 'Tempo', color: 'var(--type-tempo)' },
}

/** Date du jour figée tant que les données sont fictives. */
export const TODAY = '2026-11-18'

const SEED: Activity[] = [
  {
    id: 'a2',
    type: 'interval',
    startedAt: '2026-11-17T18:42:00+01:00',
    place: 'piste',
    distanceKm: 8.0,
    durationSec: 2550,
    avgHr: 168,
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
    garminName: 'Tempo 5 km',
    stravaName: 'Afternoon Run',
  },
]

export function useActivities() {
  const activities = useState<Activity[]>('activities', () => structuredClone(SEED))

  const byId = (id: string) => activities.value.find((a) => a.id === id)
  const isSynced = (a: Activity) => a.garminName === a.stravaName
  const toReview = computed(() => activities.value.filter((a) => !isSynced(a)))

  /** Les 7 derniers jours, aujourd'hui compris, pour l'histogramme de l'accueil. */
  const lastWeek = computed(() => {
    const end = new Date(`${TODAY}T23:59:59+01:00`)
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(end)
      d.setDate(end.getDate() - (6 - i))
      const key = d.toISOString().slice(0, 10)
      const runs = activities.value.filter((a) => a.startedAt.slice(0, 10) === key)
      return {
        key,
        letter: new Intl.DateTimeFormat('fr-BE', { weekday: 'narrow', timeZone: 'Europe/Brussels' }).format(d),
        km: runs.reduce((sum, a) => sum + a.distanceKm, 0),
      }
    })
    const runs = activities.value.filter((a) => days.some((d) => d.key === a.startedAt.slice(0, 10)))
    return {
      days,
      km: runs.reduce((s, a) => s + a.distanceKm, 0),
      sec: runs.reduce((s, a) => s + a.durationSec, 0),
      count: runs.length,
      synced: runs.filter(isSynced).length,
    }
  })

  function setStravaName(id: string, name: string) {
    const a = byId(id)
    if (a) a.stravaName = name
  }

  function setStravaDescription(id: string, text: string) {
    const a = byId(id)
    if (a) a.stravaDescription = text
  }

  return { activities, byId, isSynced, toReview, lastWeek, setStravaName, setStravaDescription }
}
