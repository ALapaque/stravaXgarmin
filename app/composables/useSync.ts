/*
 * Passage des données de démo aux vraies données Strava et Garmin.
 * Sans base de données, la synchro se fait à l'ouverture de l'appli.
 */
import type { Activity, EffortKey, RunType } from './useActivities'
import type { Lap } from '#shared/utils/compliance'
import type { GarminRecord } from './useRecords'

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

function toActivity(s: StravaRun, g: GarminRun | undefined, h: Habits, override?: RunType): Activity {
  const km = Math.round(s.distance / 100) / 10
  const auto = classify(s, g, h)
  const { type, reason } = withOverride(auto, override)
  const indoor = isIndoor(s, g)
  const sport = (['Run', 'TrailRun', 'VirtualRun'] as const).find((k) => k === s.sport_type) ?? 'Run'
  // « start_date_local » est l'heure locale écrite comme de l'UTC : ses 10 premiers caractères sont le jour local
  const localDate = /^\d{4}-\d{2}-\d{2}/.test(s.start_date_local ?? '') ? s.start_date_local!.slice(0, 10) : brusselsDay(s.start_date)
  return {
    id: `s${s.id}`,
    stravaId: s.id,
    garminId: g?.id,
    garminWorkoutId: typeof g?.workoutId === 'number' ? g.workoutId : undefined,
    type,
    typeReason: reason,
    autoType: auto.type,
    autoReason: auto.reason,
    startedAt: s.start_date,
    localDate,
    indoor,
    sport,
    // Sur tapis, la ville de Strava (celle du compte) ne dit rien du lieu
    place: indoor ? 'tapis' : (s.location_city ?? ''),
    distanceKm: km,
    durationSec: s.moving_time,
    elapsedSec: s.elapsed_time ?? s.moving_time,
    avgHr: Math.round(s.average_heartrate ?? 0),
    maxHr: s.max_heartrate ? Math.round(s.max_heartrate) : undefined,
    workoutType: typeof s.workout_type === 'number' ? s.workout_type : undefined,
    elevationM: Math.round(s.total_elevation_gain ?? 0),
    splits: [],
    bestEfforts: {},
    garminName: g?.name ?? s.name,
    stravaName: s.name,
    // Jamais de tracé pour une séance sur tapis (certaines montres en inventent un)
    route: indoor ? undefined : s.map?.summary_polyline || undefined,
    gearId: s.gear_id || undefined,
  }
}

export function useSync() {
  const { accounts, refresh } = useAccounts()
  const { activities, setStravaName, setGarminName, typeOverrides } = useActivities()
  const { ruleTitle } = useNaming()
  const { notify } = useNotifications()
  const settings = useSettings()
  const { show } = useToast()
  const demo = useDemo()
  const historyState = useHistory().entries
  const notifState = useNotifications().list
  const details = useState<Record<number, RunDetails>>('stravaDetails', () => ({}))
  const garminRecords = useGarminRecords()
  const plan = usePlan()
  const debriefs = useDebriefs()
  const fitness = useFitness()
  const { track, refreshDemo } = useHealth()
  const syncing = useState('syncing', () => false)
  const synced = useState('synced', () => false)

  /** « force » : synchro demandée à la main, on relit tout sans tenir compte de ce qui est gardé. */
  async function run(force: unknown = false) {
    const fresh = force === true
    if (syncing.value) return
    syncing.value = true
    try {
      await refresh()
      if (!accounts.value.strava.connected) {
        // Pas de compte : données fictives seulement si la démo est activée, sinon rien
        demo.reset()
        if (demo.active.value) {
          // « Tout relire » en démo : une courte lecture simulée, puis tout repasse en réussite
          if (fresh) await new Promise((r) => setTimeout(r, 900))
          refreshDemo(fresh)
        }
        return
      }
      demo.leaveSilently()
      // Première ouverture réelle : seules les courses des dernières 48 h réclameront un débrief
      if (!settings.value.debriefSince) settings.value.debriefSince = new Date(Date.now() - 48 * 3600_000).toISOString()

      const [strava, garmin] = await Promise.all([
        track('strava.activities', () => $fetch<StravaRun[]>('/api/strava/activities'), (l) => HEALTH_INFO.activities(l.length)),
        accounts.value.garmin.connected
          ? track('garmin.activities', () => $fetch<GarminRun[]>('/api/garmin/activities'), (l) => HEALTH_INFO.garminActivities(l.length)).catch(() => {
              show('Garmin injoignable, synchro Strava seulement')
              return [] as GarminRun[]
            })
          : Promise.resolve([] as GarminRun[]),
      ])
      const habits = habitsOf(strava)
      // La liste de Strava ne contient pas la description : on garde celle déjà lue pour chaque course
      const known = new Map(activities.value.map((a) => [a.id, a.stravaDescription]))
      activities.value = strava
        .map((s) => {
          const a = withDetails(toActivity(s, matchGarmin(s, garmin), habits, typeOverrides.value[`s${s.id}`]), details.value[s.id])
          const description = known.get(a.id)
          return description === undefined ? a : { ...a, stravaDescription: description }
        })
        .sort((a, b) => b.startedAt.localeCompare(a.startedAt))

      // Les exemples de la démo n'ont plus de sens avec de vraies données
      historyState.value = historyState.value.filter((e) => !e.id.startsWith('seed-'))
      notifState.value = notifState.value.filter((n) => !/^n\d$/.test(n.id))

      const renamed = settings.value.autoSync ? await autoApply() : new Set<string>()
      notifyDebriefs(renamed)

      // En arrière-plan : records et temps au km, sans bloquer la synchro.
      // Chaque échec est noté dans l'état des connexions (useHealth) au lieu de passer inaperçu.
      loadDetails().catch(() => {})
      fitness.loadGear(fresh).catch(() => {})
      if (accounts.value.garmin.connected) {
        loadGarminRecords(fresh).catch(() => {})
        plan.load(fresh).catch(() => {})
        fitness.loadForme(fresh).catch(() => {})
      } else {
        garminRecords.value = null
        plan.reset(false)
        fitness.forme.value = null
      }
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
  async function autoApply(): Promise<Set<string>> {
    const renamed = new Set<string>()
    if (!settings.value.autoSince) {
      settings.value.autoSince = new Date().toISOString()
      return renamed
    }
    const since = settings.value.autoSince
    const touched = new Set(historyState.value.map((e) => e.activityId))
    for (const a of activities.value) {
      if (a.startedAt <= since || touched.has(a.id)) continue
      const rule = settings.value.naming.enabled ? ruleTitle(a) : ''
      const decision = decideAutoName({
        stravaName: a.stravaName,
        garminName: a.garminName,
        hasGarmin: Boolean(a.garminId),
        ruleTitle: rule,
        overwriteEdited: settings.value.overwriteEdited,
      })
      if (decision && (await setStravaName(a.id, decision.target, decision.source))) {
        renamed.add(a.id)
        notify({ kind: 'titles', title: 'Nom appliqué sur Strava', body: decision.target, to: `/activites/${a.id}` })
      }

      // Option : le nom générique côté montre est aussi remplacé dans Garmin Connect
      if (settings.value.garmin.rename && a.garminId && isGenericName(a.garminName) && rule) {
        await setGarminName(a.id, rule, 'regle')
      }
    }
    return renamed
  }

  /**
   * Course à débriefer : « Ta séance attend son débrief » (lien vers le Débrief), une seule fois par course,
   * à la place de « Nom appliqué » quand la synchro n'a rien renommé. Les trois plus récentes au plus.
   */
  function notifyDebriefs(renamed: Set<string>) {
    for (const a of debriefs.toDebrief.value.slice(0, 3)) {
      const to = `/activites/${a.id}/debrief`
      if (renamed.has(a.id) || notifState.value.some((n) => n.to === to)) continue
      notify({ kind: 'review', title: 'Ta séance attend son débrief', body: displayTitle(a).title, to })
    }
  }

  /** Détail Strava des courses pas encore vues (meilleurs efforts, records, temps au km), 15 par appel. */
  async function loadDetails() {
    for (let round = 0; round < 2; round++) {
      // Une entrée gardée par la version précédente (sans « v: 2 », donc sans tours) compte comme manquante
      const missing = activities.value.filter((a) => a.stravaId && details.value[a.stravaId]?.v !== 2).map((a) => a.stravaId!).slice(0, 15)
      if (!missing.length) return
      const got = await track(
        'strava.details',
        () => $fetch<Record<number, RunDetails>>('/api/strava/details', { method: 'POST', body: { ids: missing } }),
        (r) => HEALTH_INFO.details(Object.keys(r).length, missing.length),
      )
      details.value = { ...details.value, ...got }
      for (const a of activities.value) {
        const d = a.stravaId ? got[a.stravaId] : undefined
        if (d) Object.assign(a, withDetails(a, d))
      }
      if (Object.keys(got).length < missing.length) return // limite Strava : la suite au prochain passage
    }
  }

  /** Records Garmin : relus au plus une fois par heure, ou tout de suite sur demande. */
  async function loadGarminRecords(force = false) {
    const at = garminRecords.value?.at
    if (!force && at && Date.now() - Date.parse(at) < 3600_000) return
    const list = await track('garmin.records', () => $fetch<GarminRecord[]>('/api/garmin/records'), (l) => HEALTH_INFO.records(l.length))
    garminRecords.value = { at: new Date().toISOString(), list }
  }

  return { run, syncing, synced }
}

/** Détail d'une course gardé dans le navigateur ; « v: 2 » ajoute tours, FC au km et FC max. */
export interface RunDetails {
  v?: 2
  efforts: Record<string, number>
  prs: string[]
  splits: number[]
  splitHr?: number[]
  laps?: Lap[]
  maxHr?: number | null
}

/** Lecture défensive : une entrée gardée peut venir d'une version précédente. */
function withDetails(a: Activity, d?: RunDetails): Activity {
  if (!d || typeof d !== 'object') return a
  const splits = Array.isArray(d.splits) && d.splits.length ? d.splits : a.splits
  return {
    ...a,
    bestEfforts: (d.efforts ?? {}) as Activity['bestEfforts'],
    prs: (Array.isArray(d.prs) ? d.prs : []) as EffortKey[],
    splits,
    splitHr: Array.isArray(d.splitHr) && d.splitHr.length === splits.length ? d.splitHr : a.splitHr,
    laps: Array.isArray(d.laps) ? d.laps : a.laps,
    maxHr: d.maxHr || a.maxHr,
  }
}
