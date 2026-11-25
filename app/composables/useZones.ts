/*
 * Zones cardio du coureur, dans l'ordre : celles de sa montre Garmin (quand Garmin est connecté), sinon
 * celles de son compte Strava, sinon un calcul sur sa FC max. Le coureur peut imposer une source
 * (Réglages → Coureur). Pour la montre et pour Strava, l'appli reprend les seuils ET le temps par zone
 * comptés à la source : elle affiche alors la même chose qu'eux.
 * Lectures à la demande seulement (jamais pendant la synchro), gardées dans le navigateur.
 * Le choix lui-même est une fonction pure : pickZones (shared/utils/zones.ts).
 */
import type { AccountZones, RunZones, StravaZonesReply, WatchRunZonesReply, WatchZonesReply, ZonePick, ZoneProvider, ZoneSource } from '#shared/utils/zones'
import type { Activity } from './useActivities'

/** Lectures gardées (deux sources possibles par course) */
const KEEP = 120
const DAY_MS = 24 * 3600 * 1000
/** Une lecture qui vient d'échouer n'est pas retentée avant dix minutes */
const RETRY_AFTER_MS = 10 * 60 * 1000
/** Pas de second essai automatique : un échec est noté, la source suivante prend le relais */
const ONCE = { retry: 0 } as const

type Read = 'garmin:account' | 'garmin:run' | 'strava:run'

export function useZones() {
  const settings = useSettings()
  const { activities } = useActivities()
  const { accounts: linked } = useAccounts()
  const { active: demo } = useDemo()
  /** Zones lues pour une course, par source : clé « garmin:<id> » ou « strava:<id> » */
  const saved = useState<Record<string, { at: string; data: RunZones }>>('zones', () => ({}))
  /** Dernières zones connues de chaque compte */
  const accounts = useState<Partial<Record<ZoneProvider, AccountZones>>>('zonesAccount', () => ({}))
  const busy = useState<Record<string, boolean>>('zones-busy', () => ({}))
  /**
   * Heure du dernier échec de chaque lecture, gardée elle aussi : une lecture qui échoue (Garmin surtout,
   * dont l'API n'est pas officielle) n'est pas redemandée à chaque ouverture de l'appli.
   */
  const failed = useState<Record<string, number>>('zonesFailed', () => ({}))

  /** En démo, les trois comptes (fictifs) comptent comme connectés */
  const garminOn = computed(() => demo.value || Boolean(linked.value.garmin.connected))
  /** Source voulue, « auto » résolu : la montre si Garmin est connecté, sinon Strava */
  const source = computed<ZoneSource>(() => {
    const choice = settings.value.zoneSource ?? 'auto'
    return choice === 'auto' ? (garminOn.value ? 'garmin' : 'strava') : choice
  })

  const age = (iso: string | null | undefined) => (iso ? Date.now() - Date.parse(iso) : Number.POSITIVE_INFINITY)
  const justFailed = (key: string) => Date.now() - (failed.value?.[key] ?? 0) < RETRY_AFTER_MS
  /** Note l'échec d'une lecture, et oublie ceux de plus de dix minutes. */
  function fail(key: string) {
    const now = Date.now()
    const recent = Object.entries(failed.value ?? {}).filter(([, at]) => now - at < RETRY_AFTER_MS)
    failed.value = Object.fromEntries([...recent, [key, now]])
  }
  const has = (p: ZoneProvider, a: Activity) => Boolean(saved.value?.[`${p}:${a.id}`])
  const watchReadable = () => !demo.value && Boolean(linked.value.garmin.connected)
  const watchKnown = () => Boolean(validFloors(accounts.value?.garmin?.floors))
  /** Strava a dit « réservé aux abonnés » il y a moins d'un jour */
  const stravaOff = () => Boolean(accounts.value?.strava?.off) && age(accounts.value?.strava?.at) < DAY_MS

  /** Zones des comptes : en démo, celles de comptes fictifs (rien n'est gardé). */
  const known = computed<Partial<Record<ZoneProvider, Pick<AccountZones, 'floors' | 'low' | 'top' | 'off' | 'custom' | 'method'>>>>(() => {
    if (!demo.value) return accounts.value ?? {}
    const watch = demoWatchZones(activities.value)
    return {
      garmin: { floors: watch.floors, low: watch.low, top: watch.top, off: false, custom: false, method: watch.method },
      strava: { floors: demoZoneFloors(activities.value), low: null, top: null, off: false, custom: false, method: null },
    }
  })

  /**
   * Lectures qu'il reste à faire avant de pouvoir afficher les zones de cette course.
   * La montre d'abord : ses zones de compte si on n'en connaît aucune, et celles de la course. Strava
   * seulement s'il est la source voulue, ou si la montre n'a plus rien à donner.
   */
  function todo(a: Activity): Read[] {
    const src = source.value
    if (src === 'fcmax' || demo.value) return []
    const out: Read[] = []
    if (src === 'garmin' && watchReadable()) {
      if (!watchKnown() && !justFailed('garmin:account')) out.push('garmin:account')
      if (a.garminId && !has('garmin', a) && !justFailed(`garmin:${a.id}`)) out.push('garmin:run')
      if (out.length || has('garmin', a) || watchKnown()) return out
    }
    if (a.stravaId && !has('strava', a) && !stravaOff() && !justFailed(`strava:${a.id}`)) out.push('strava:run')
    return out
  }

  /**
   * Reste-t-il une lecture à attendre pour cette course ? Tant que oui, la page d'une course attend
   * plutôt que d'afficher des zones qui changeraient sous les yeux une seconde plus tard.
   */
  const pending = (a: Activity) => Boolean(busy.value[a.id]) || todo(a).length > 0

  /** Garde les zones d'une course ; au-delà de 120 lectures, la plus ancienne sort. */
  function keep(key: string, data: RunZones) {
    const next = { ...saved.value, [key]: { at: new Date().toISOString(), data } }
    const keys = Object.keys(next).sort((a, b) => next[b]!.at.localeCompare(next[a]!.at))
    for (const old of keys.slice(KEEP)) delete next[old]
    saved.value = next
  }

  /** Zones réglées sur la montre. Un échec est noté dans l'état des connexions. */
  async function readWatch(): Promise<void> {
    try {
      const r = await useHealth().track('garmin.zones', () => $fetch<WatchZonesReply>('/api/garmin/zones', ONCE), (x) => HEALTH_INFO.watchZones(x.zones))
      if (!r.zones) return void fail('garmin:account')
      accounts.value = {
        ...accounts.value,
        garmin: { at: new Date().toISOString(), runAt: '', floors: r.zones.floors, low: r.zones.low, top: r.zones.top, custom: false, off: false, method: r.zones.method },
      }
    } catch {
      fail('garmin:account')
    }
  }

  /** Zones et temps par zone d'une course, comptés par la montre. */
  async function readWatchRun(a: Activity): Promise<void> {
    const key = `garmin:${a.id}`
    try {
      const r = await useHealth().track('garmin.runZones', () => $fetch<WatchRunZonesReply>(`/api/garmin/zones/${a.garminId}`, ONCE), (x) => HEALTH_INFO.watchRunZones(x.zones))
      if (!r.zones) return void fail(key)
      keep(key, r.zones)
      // Sans zones lues dans le compte, celles de la course la plus récente en tiennent lieu
      const old = accounts.value?.garmin
      if (!old?.floors || (old.runAt && a.startedAt >= old.runAt)) {
        accounts.value = {
          ...accounts.value,
          garmin: { at: '', runAt: a.startedAt, floors: r.zones.floors, low: r.zones.low, top: null, custom: false, off: false, method: null },
        }
      }
    } catch {
      fail(key)
    }
  }

  /** Zones et temps par zone d'une course, comptés par Strava (réservé à ses abonnés). */
  async function readStravaRun(a: Activity): Promise<void> {
    const key = `strava:${a.id}`
    try {
      const r = await useHealth().track('strava.zones', () => $fetch<StravaZonesReply>(`/api/strava/zones/${a.stravaId}`, ONCE), (x) => HEALTH_INFO.zones(x))
      const now = new Date().toISOString()
      const old = accounts.value?.strava
      if (!r.available) {
        // On garde les derniers seuils connus, et on ne redemande pas avant un jour
        accounts.value = {
          ...accounts.value,
          strava: { at: now, runAt: old?.runAt ?? '', floors: old?.floors ?? null, low: null, top: null, custom: old?.custom ?? false, off: true, method: null },
        }
        return
      }
      if (!r.zones) {
        // Strava n'a pas (encore) de zones pour cette course : rien n'est gardé
        if (old?.off) accounts.value = { ...accounts.value, strava: { ...old, off: false } }
        return void fail(key)
      }
      keep(key, r.zones)
      // Les seuils du compte suivent la course la plus récente lue (une vieille course porte d'anciens seuils)
      const fresh = !old?.floors || a.startedAt >= old.runAt
      accounts.value = {
        ...accounts.value,
        strava: fresh
          ? { at: now, runAt: a.startedAt, floors: r.zones.floors, low: null, top: null, custom: r.zones.custom, off: false, method: null }
          : { ...old!, at: now, off: false },
      }
    } catch {
      fail(key)
    }
  }

  /** Les zones de la montre sont relues une fois par jour, sans faire attendre l'écran. */
  function refreshWatch() {
    const lock = 'garmin:account'
    if (source.value !== 'garmin' || !watchReadable() || !watchKnown() || busy.value[lock]) return
    if (age(accounts.value?.garmin?.at) < DAY_MS || justFailed(lock)) return
    busy.value = { ...busy.value, [lock]: true }
    void readWatch().finally(() => {
      const { [lock]: _, ...rest } = busy.value
      busy.value = rest
    })
  }

  /** Fait les lectures qui manquent pour cette course (la montre, puis Strava si elle n'a rien donné). */
  async function load(a: Activity): Promise<void> {
    if (busy.value[a.id]) return
    refreshWatch()
    if (!todo(a).length) return
    busy.value = { ...busy.value, [a.id]: true }
    try {
      // Chaque lecture finit gardée ou marquée en échec : trois tours suffisent (montre, puis Strava)
      for (let round = 0; round < 3; round++) {
        const reads = todo(a)
        if (!reads.length) break
        await Promise.all(reads.map((r) => (r === 'garmin:account' ? readWatch() : r === 'garmin:run' ? readWatchRun(a) : readStravaRun(a))))
      }
    } finally {
      const { [a.id]: _, ...rest } = busy.value
      busy.value = rest
    }
  }

  /** Depuis les réglages : les zones de la source voulue, relues une fois par jour au plus. */
  async function loadLatest(): Promise<void> {
    const src = source.value
    if (demo.value || src === 'fcmax') return
    if (src === 'garmin' && watchReadable()) {
      if (age(accounts.value?.garmin?.at) > DAY_MS && !justFailed('garmin:account')) await readWatch()
      if (watchKnown()) return
    }
    // Strava (voulu, ou à défaut de la montre) : ses zones viennent avec la dernière course qui a du cardio
    if (age(accounts.value?.strava?.at) < DAY_MS) return
    const last = [...activities.value].filter((a) => a.stravaId && a.avgHr > 0).sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0]
    if (last && !justFailed(`strava:${last.id}`)) await readStravaRun(last)
  }

  /** Zones à afficher pour une course (ou, sans course, celles du coureur pour les réglages). */
  function pick(a?: Activity | null): ZonePick {
    const run = (p: ZoneProvider): RunZones | null => {
      if (!a) return null
      if (!demo.value) return saved.value?.[`${p}:${a.id}`]?.data ?? null
      const k = known.value[p]
      return k?.floors ? { floors: k.floors, low: k.low ?? null, sec: null, custom: false } : null
    }
    return pickZones({
      source: source.value,
      garminOn: garminOn.value,
      runs: { garmin: run('garmin'), strava: run('strava') },
      accounts: known.value,
      hrMax: settings.value.hrMax,
      estimated: estimateHrMax(activities.value),
    })
  }

  return { source, garminOn, known, pick, load, loadLatest, pending }
}
