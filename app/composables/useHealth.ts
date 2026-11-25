/*
 * État des connexions : chaque vrai appel à Strava, Garmin ou l'IA note sa réussite ou son échec,
 * pour qu'une lecture qui échoue ne passe plus inaperçue (écran /reglages/etat).
 * La partie pure (résumé, diagnostic, sous-titres) vit dans shared/utils/health.ts.
 */

/** Démo : toutes les lectures réussies, datées de « nowIso », avec des sous-titres tirés des données de démo. */
export function demoHealth(nowIso: string): Health {
  const { activities: runs, plan } = demoBase()
  const bests = new Set(runs.flatMap((r) => Object.keys(r.bestEfforts)))
  const today = brusselsDay(nowIso)
  const infos: Record<HealthKey, string> = {
    'strava.activities': HEALTH_INFO.activities(runs.length),
    'strava.details': HEALTH_INFO.details(runs.length, runs.length),
    'strava.gear': HEALTH_INFO.gear(2),
    'strava.streams': HEALTH_INFO.streams({ hr: true, v: true }),
    'strava.zones': HEALTH_INFO.zones({ available: true, zones: { floors: demoZoneFloors(runs), custom: false } }),
    'garmin.zones': HEALTH_INFO.watchZones(demoWatchZones(runs)),
    'garmin.runZones': HEALTH_INFO.watchRunZones({ sec: [1] }),
    'garmin.activities': HEALTH_INFO.garminActivities(runs.length),
    'garmin.plan': HEALTH_INFO.plan(plan.filter((s) => s.date >= today).length, plan.filter((s) => s.date < today).length),
    'garmin.forme': HEALTH_INFO.forme(demoBase().forme),
    'garmin.records': HEALTH_INFO.records(bests.size),
    ai: HEALTH_INFO.ai(),
  }
  return Object.fromEntries(HEALTH_KEYS.map((k) => [k, markOk(undefined, nowIso, infos[k])])) as Health
}

export function useHealth() {
  const health = useState<Health>('health', () => (isDemoCookie() ? demoHealth(new Date().toISOString()) : emptyHealth()))
  const { accounts } = useAccounts()
  const { active: demo } = useDemo()

  /** Comptes pris en compte : en démo, les trois comptes (fictifs) sont considérés comme connectés. */
  const connected = computed<Connected>(() =>
    demo.value
      ? { strava: true, garmin: true, ai: true }
      : { strava: accounts.value.strava.connected, garmin: accounts.value.garmin.connected, ai: accounts.value.ai.connected },
  )
  const summary = computed(() => healthSummary(health.value, connected.value))
  const entry = (key: HealthKey) => health.value[key] ?? emptyEntry()

  /**
   * Exécute un vrai appel réseau et note le résultat, puis relance l'erreur : l'appelant décide de continuer.
   * À placer autour du $fetch lui-même, pas d'une fonction qui peut sortir tôt (donnée encore fraîche) :
   * une lecture sautée ne compte pas comme une réussite.
   */
  async function track<T>(key: HealthKey, fn: () => Promise<T>, info?: (result: T) => string | null | undefined): Promise<T> {
    try {
      const result = await fn()
      health.value = { ...health.value, [key]: markOk(entry(key), new Date().toISOString(), info?.(result)) }
      return result
    } catch (e) {
      const err = e as { statusCode?: number; status?: number; data?: { statusMessage?: string } }
      const code = err.statusCode ?? err.status ?? null
      health.value = { ...health.value, [key]: markError(entry(key), new Date().toISOString(), err.data?.statusMessage ?? 'Pas de réponse', code) }
      throw e
    }
  }

  /**
   * Démo, à chaque ouverture : les lectures réussies sont re-datées à maintenant (sinon « il y a 3 jours »).
   * Une lecture en échec n'est pas touchée : c'est ce qui permet de montrer un cas d'échec.
   * « all » (bouton « Tout relire ») : toutes les sources repassent en réussite.
   * « infos » : les lectures réussies reprennent les sous-titres de la démo du jour (démo régénérée).
   */
  function refreshDemo(all = false, infos = false) {
    const now = new Date().toISOString()
    const fresh = demoHealth(now)
    health.value = Object.fromEntries(
      HEALTH_KEYS.map((k) => {
        const e = health.value[k]
        if (!all && e?.status === 'error') return [k, e]
        return [k, e?.status === 'ok' && e.info && !infos ? markOk(e, now) : fresh[k]]
      }),
    ) as Health
  }

  function reset(demoOn: boolean) {
    health.value = demoOn ? demoHealth(new Date().toISOString()) : emptyHealth()
  }

  return { health, connected, summary, entry, track, refreshDemo, reset }
}
