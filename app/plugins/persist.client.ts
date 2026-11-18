/*
 * Garde l'état de l'appli dans le navigateur entre deux visites, tant que
 * les données sont fictives (plus tard : base de données côté serveur).
 * Chargé une fois l'appli hydratée et au repos (pages asynchrones comprises),
 * pour ne pas créer d'écart avec le rendu serveur.
 */
const KEYS = ['settings', 'activities', 'history', 'notifications', 'stravaDetails', 'garminRecords', 'aiResults'] as const
const VERSION = 2
const prefix = `sxg:v${VERSION}:`

export default defineNuxtPlugin(() => {
  onNuxtReady(() => {
    // Les données ne sont reprises que si elles ont un sens : démo active ou Strava connecté
    const accounts = useState<{ strava?: { connected?: boolean } }>('accounts')
    const dataAllowed = isDemoCookie() || Boolean(accounts.value?.strava?.connected)
    for (const key of KEYS) {
      const state = useState<unknown>(key)
      try {
        const saved = localStorage.getItem(prefix + key)
        if (saved && (key === 'settings' || dataAllowed)) {
          const value = JSON.parse(saved)
          // Fusion douce pour les réglages : les nouvelles options gardent leur valeur par défaut
          state.value = key === 'settings' && state.value && typeof state.value === 'object'
            ? deepMerge(state.value as Record<string, unknown>, value)
            : value
        }
      } catch {
        // Stockage indisponible (navigation privée…) : on reste sur l'état par défaut
      }
      watch(state, (v) => {
        try {
          localStorage.setItem(prefix + key, JSON.stringify(v))
        } catch {
          /* ignore */
        }
      }, { deep: true })
    }
  })
})

function deepMerge(base: Record<string, unknown>, extra: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base }
  for (const [k, v] of Object.entries(extra)) {
    const b = base[k]
    out[k] = b && v && typeof b === 'object' && typeof v === 'object' && !Array.isArray(v)
      ? deepMerge(b as Record<string, unknown>, v as Record<string, unknown>)
      : v
  }
  return out
}
