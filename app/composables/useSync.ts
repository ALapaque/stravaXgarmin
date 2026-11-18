/*
 * Passage des données de démo aux vraies données Strava et Garmin.
 * Sans base de données, la synchro se fait à l'ouverture de l'appli.
 */
import type { Activity, RunType } from './useActivities'

interface StravaRun {
  id: number
  name: string
  start_date: string
  distance: number
  moving_time: number
  total_elevation_gain: number
  average_heartrate?: number
  workout_type?: number | null
  location_city?: string | null
}

interface GarminRun {
  id: number
  name: string
  startTimeGMT: string
  distance?: number
}

export interface Accounts {
  loaded: boolean
  strava: { connected: boolean; name: string | null }
  garmin: { connected: boolean; name: string | null }
}

export function useAccounts() {
  const accounts = useState<Accounts>('accounts', () => ({
    loaded: false,
    strava: { connected: false, name: null },
    garmin: { connected: false, name: null },
  }))

  async function refresh() {
    try {
      const me = await $fetch<Omit<Accounts, 'loaded'>>('/api/me')
      accounts.value = { loaded: true, ...me }
    } catch {
      // Variables d'environnement absentes ou hors ligne : on reste en démo
      accounts.value = { ...accounts.value, loaded: true }
    }
  }

  async function disconnect(provider: 'strava' | 'garmin') {
    await $fetch(provider === 'strava' ? '/api/auth/strava/logout' : '/api/garmin/logout', { method: 'POST' })
    await refresh()
  }

  const isDemo = computed(() => !accounts.value.strava.connected)
  return { accounts, refresh, disconnect, isDemo }
}

function guessType(s: StravaRun): RunType {
  const km = s.distance / 1000
  const pace = s.moving_time / Math.max(km, 0.1)
  if (s.workout_type === 2 || km >= 14) return 'long'
  if (/fraction|interval|vma|piste|\d+\s*[x×]\s*\d+/i.test(s.name)) return 'interval'
  if (/tempo|seuil|threshold/i.test(s.name)) return 'tempo'
  if (pace >= 330) return 'recovery'
  if (km >= 11) return 'long'
  if (pace < 300) return 'tempo'
  return 'recovery'
}

/** Relie une course Strava à l'activité Garmin qui a commencé à moins de 3 minutes d'écart. */
function matchGarmin(s: StravaRun, garmin: GarminRun[]) {
  const t = Date.parse(s.start_date)
  return garmin.find((g) => Math.abs(Date.parse(`${g.startTimeGMT.replace(' ', 'T')}Z`) - t) < 180_000)
}

function toActivity(s: StravaRun, g?: GarminRun): Activity {
  const km = Math.round(s.distance / 100) / 10
  return {
    id: `s${s.id}`,
    stravaId: s.id,
    garminId: g?.id,
    type: guessType(s),
    startedAt: s.start_date,
    place: s.location_city ?? '',
    distanceKm: km,
    durationSec: s.moving_time,
    avgHr: Math.round(s.average_heartrate ?? 0),
    elevationM: Math.round(s.total_elevation_gain ?? 0),
    splits: [],
    bestEfforts: {},
    garminName: g?.name ?? s.name,
    stravaName: s.name,
  }
}

export function useSync() {
  const { accounts, refresh } = useAccounts()
  const { activities, setStravaName, setGarminName } = useActivities()
  const { ruleTitle } = useNaming()
  const { notify } = useNotifications()
  const settings = useSettings()
  const { show } = useToast()
  const syncing = useState('syncing', () => false)

  async function run() {
    if (syncing.value) return
    syncing.value = true
    try {
      await refresh()
      if (!accounts.value.strava.connected) {
        // Déconnecté après avoir utilisé de vraies données : retour à la démo
        if (activities.value.some((a) => a.stravaId)) activities.value = demoActivities()
        return
      }

      const [strava, garmin] = await Promise.all([
        $fetch<StravaRun[]>('/api/strava/activities'),
        accounts.value.garmin.connected
          ? $fetch<GarminRun[]>('/api/garmin/activities').catch(() => {
              show('Garmin injoignable, synchro Strava seulement')
              return [] as GarminRun[]
            })
          : Promise.resolve([] as GarminRun[]),
      ])
      activities.value = strava
        .map((s) => toActivity(s, matchGarmin(s, garmin)))
        .sort((a, b) => b.startedAt.localeCompare(a.startedAt))

      // Les exemples de la démo n'ont plus de sens avec de vraies données
      const history = useHistory().entries
      history.value = history.value.filter((e) => !e.id.startsWith('seed-'))
      const notifs = useNotifications().list
      notifs.value = notifs.value.filter((n) => !/^n\d$/.test(n.id))

      if (settings.value.autoSync) await autoApply()
    } catch (e) {
      show((e as { data?: { statusMessage?: string } }).data?.statusMessage ?? 'Synchro impossible pour le moment')
    } finally {
      syncing.value = false
    }
  }

  /**
   * Sur les 7 derniers jours, remplace les noms Strava génériques :
   * par le nom Garmin s'il est parlant, sinon par la règle de nommage.
   */
  async function autoApply() {
    const since = Date.now() - 7 * 24 * 3600 * 1000
    for (const a of activities.value) {
      if (Date.parse(a.startedAt) < since) continue
      const garminIsGood = a.garminId && !isGenericName(a.garminName)
      const rule = settings.value.naming.enabled ? ruleTitle(a) : ''

      if (isGenericName(a.stravaName) || settings.value.overwriteEdited) {
        const target = garminIsGood ? a.garminName : rule
        if (target && target !== a.stravaName && (await setStravaName(a.id, target, garminIsGood ? 'garmin' : 'regle'))) {
          notify({ kind: 'titles', title: 'Nom appliqué sur Strava', body: target, to: `/activites/${a.id}` })
        }
      }

      // Option : le nom générique côté montre est aussi remplacé dans Garmin Connect
      if (settings.value.garmin.rename && a.garminId && isGenericName(a.garminName) && rule) {
        await setGarminName(a.id, rule, 'regle')
      }
    }
  }

  return { run, syncing }
}
