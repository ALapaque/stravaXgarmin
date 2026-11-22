/*
 * Courbes (cardio, allure) d'une course, chargées À LA DEMANDE seulement (jamais pendant la synchro,
 * pour ménager la limite Strava), puis gardées dans le navigateur pour les 12 dernières courses consultées.
 */
import type { RunStream } from '#shared/utils/streams'
import type { Activity } from './useActivities'

export type { RunStream }

const KEEP = 12

export function useStreams() {
  const saved = useState<Record<string, { at: string; data: RunStream }>>('streams', () => ({}))
  const loading = useState<Record<string, boolean>>('streams-loading', () => ({}))

  const get = (id: string): RunStream | null => saved.value?.[id]?.data ?? null

  /** Garde la course consultée ; au-delà de 12, la plus ancienne consultation sort. */
  function keep(id: string, data: RunStream) {
    const next = { ...saved.value, [id]: { at: new Date().toISOString(), data } }
    const ids = Object.keys(next).sort((a, b) => next[b]!.at.localeCompare(next[a]!.at))
    for (const old of ids.slice(KEEP)) delete next[old]
    saved.value = next
  }

  /** Courbes de la course (gardées, sinon lues chez Strava ; en démo, fabriquées). null si la lecture échoue. */
  async function load(a: Activity): Promise<RunStream | null> {
    const have = get(a.id)
    if (have) {
      keep(a.id, have)
      return have
    }
    if (loading.value[a.id]) return null
    loading.value = { ...loading.value, [a.id]: true }
    try {
      const data = a.stravaId
        ? await useHealth().track('strava.streams', () => $fetch<RunStream>(`/api/strava/streams/${a.stravaId}`), (s) => HEALTH_INFO.streams(s))
        : demoStream(a)
      keep(a.id, data)
      return data
    } catch {
      // L'échec est noté dans l'état des connexions
      return null
    } finally {
      const { [a.id]: _, ...rest } = loading.value
      loading.value = rest
    }
  }

  const isLoading = (id: string) => Boolean(loading.value[id])

  return { streams: saved, get, load, isLoading }
}
