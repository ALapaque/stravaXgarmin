/*
 * Passage des données de démo aux vraies données Strava et Garmin.
 * Sans base de données, la synchro se fait à l'ouverture de l'appli.
 */
import type { Activity, EffortKey, RunType } from './useActivities'
import type { GarminRecord } from './useRecords'

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
  /** IA avec la clé de l'utilisateur ; « name » : fournisseur et modèle */
  ai: { connected: boolean; provider: 'gemini' | 'mistral' | 'openai' | null; name: string | null }
}

export function useAccounts() {
  const accounts = useState<Accounts>('accounts', () => ({
    loaded: false,
    strava: { connected: false, name: null },
    garmin: { connected: false, name: null },
    ai: { connected: false, provider: null, name: null },
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

  async function disconnect(provider: 'strava' | 'garmin' | 'ai') {
    const url = { strava: '/api/auth/strava/logout', garmin: '/api/garmin/logout', ai: '/api/ia/logout' }[provider]
    await $fetch(url, { method: 'POST' })
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
  const demo = useDemo()
  const historyState = useHistory().entries
  const notifState = useNotifications().list
  const details = useState<Record<number, RunDetails>>('stravaDetails', () => ({}))
  const garminRecords = useGarminRecords()
  const syncing = useState('syncing', () => false)
  const synced = useState('synced', () => false)

  async function run() {
    if (syncing.value) return
    syncing.value = true
    try {
      await refresh()
      if (!accounts.value.strava.connected) {
        // Pas de compte : données fictives seulement si la démo est activée, sinon rien
        demo.reset()
        return
      }
      demo.leaveSilently()

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
        .map((s) => withDetails(toActivity(s, matchGarmin(s, garmin)), details.value[s.id]))
        .sort((a, b) => b.startedAt.localeCompare(a.startedAt))

      // Les exemples de la démo n'ont plus de sens avec de vraies données
      historyState.value = historyState.value.filter((e) => !e.id.startsWith('seed-'))
      notifState.value = notifState.value.filter((n) => !/^n\d$/.test(n.id))

      if (settings.value.autoSync) await autoApply()

      // En arrière-plan : records et temps au km, sans bloquer la synchro
      loadDetails().catch(() => {})
      if (accounts.value.garmin.connected) loadGarminRecords().catch(() => {})
      else garminRecords.value = null
    } catch (e) {
      show((e as { data?: { statusMessage?: string } }).data?.statusMessage ?? 'Synchro impossible pour le moment')
    } finally {
      syncing.value = false
      synced.value = true
    }
  }

  /**
   * Sur les 7 derniers jours, remplace les noms Strava génériques :
   * par le nom Garmin s'il est parlant, sinon par la règle de nommage.
   */
  /**
   * Renommage automatique, volontairement prudent :
   * - seulement les courses faites APRÈS la première connexion (jamais l'historique) ;
   * - une seule fois par course : une course déjà modifiée ou annulée n'est plus touchée ;
   * - une règle ne remplace qu'un nom générique (« Morning Run »…), jamais un nom écrit par toi ;
   * - le nom Garmin remplace un nom générique, ou n'importe quel nom si « Écraser » est activé.
   */
  async function autoApply() {
    if (!settings.value.autoSince) {
      settings.value.autoSince = new Date().toISOString()
      return
    }
    const since = settings.value.autoSince
    const touched = new Set(historyState.value.map((e) => e.activityId))
    for (const a of activities.value) {
      if (a.startedAt <= since || touched.has(a.id)) continue
      const stravaGeneric = isGenericName(a.stravaName)
      const garminIsGood = Boolean(a.garminId) && !isGenericName(a.garminName)
      const rule = settings.value.naming.enabled ? ruleTitle(a) : ''

      let target = ''
      let source: 'garmin' | 'regle' = 'garmin'
      if (garminIsGood && a.garminName !== a.stravaName && (stravaGeneric || settings.value.overwriteEdited)) target = a.garminName
      else if (stravaGeneric && rule) {
        target = rule
        source = 'regle'
      }
      if (target && target !== a.stravaName && (await setStravaName(a.id, target, source))) {
        notify({ kind: 'titles', title: 'Nom appliqué sur Strava', body: target, to: `/activites/${a.id}` })
      }

      // Option : le nom générique côté montre est aussi remplacé dans Garmin Connect
      if (settings.value.garmin.rename && a.garminId && isGenericName(a.garminName) && rule) {
        await setGarminName(a.id, rule, 'regle')
      }
    }
  }

  /** Détail Strava des courses pas encore vues (meilleurs efforts, records, temps au km), 15 par appel. */
  async function loadDetails() {
    for (let round = 0; round < 2; round++) {
      const missing = activities.value.filter((a) => a.stravaId && !details.value[a.stravaId]).map((a) => a.stravaId!).slice(0, 15)
      if (!missing.length) return
      const got = await $fetch<Record<number, RunDetails>>('/api/strava/details', { method: 'POST', body: { ids: missing } })
      details.value = { ...details.value, ...got }
      for (const a of activities.value) {
        const d = a.stravaId ? got[a.stravaId] : undefined
        if (d) Object.assign(a, withDetails(a, d))
      }
      if (Object.keys(got).length < missing.length) return // limite Strava : la suite au prochain passage
    }
  }

  /** Records Garmin : relus au plus toutes les 6 heures. */
  async function loadGarminRecords() {
    const at = garminRecords.value?.at
    if (at && Date.now() - Date.parse(at) < 6 * 3600_000) return
    const list = await $fetch<GarminRecord[]>('/api/garmin/records')
    garminRecords.value = { at: new Date().toISOString(), list }
  }

  return { run, syncing, synced }
}

export interface RunDetails {
  efforts: Record<string, number>
  prs: string[]
  splits: number[]
}

function withDetails(a: Activity, d?: RunDetails): Activity {
  if (!d) return a
  return {
    ...a,
    bestEfforts: d.efforts as Activity['bestEfforts'],
    prs: d.prs as EffortKey[],
    splits: d.splits.length ? d.splits : a.splits,
  }
}
