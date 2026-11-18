import type { Activity, EffortKey } from './useActivities'

export const EFFORTS: Record<EffortKey, { label: string }> = {
  '5k': { label: '5 km' },
  '10k': { label: '10 km' },
  half: { label: 'Semi' },
}

export interface RecordHit {
  key: EffortKey
  label: string
  time: number
  /** Ancien record battu, si il y en avait un */
  previous?: number
}

/**
 * Records personnels à partir des meilleurs efforts.
 * Une course bat un record si son effort est plus rapide que tous ceux d'avant.
 */
export function useRecords() {
  const { activities } = useActivities()

  const chrono = computed(() => [...activities.value].sort((a, b) => a.startedAt.localeCompare(b.startedAt)))

  const hitsById = computed(() => {
    const best: Partial<Record<EffortKey, number>> = {}
    const map = new Map<string, RecordHit[]>()
    for (const a of chrono.value) {
      for (const key of Object.keys(EFFORTS) as EffortKey[]) {
        const t = a.bestEfforts[key]
        if (t === undefined) continue
        const prev = best[key]
        if (prev === undefined || t < prev) {
          best[key] = t
          // Le tout premier effort n'est pas un record « battu » : on ne le signale pas
          if (prev !== undefined) {
            const list = map.get(a.id) ?? []
            list.push({ key, label: EFFORTS[key].label, time: t, previous: prev })
            map.set(a.id, list)
          }
        }
      }
    }
    return map
  })

  const recordsOf = (a: Activity) => hitsById.value.get(a.id) ?? []

  /** Meilleur temps actuel pour chaque distance */
  const bests = computed(() =>
    (Object.keys(EFFORTS) as EffortKey[]).map((key) => {
      let winner: Activity | undefined
      for (const a of activities.value) {
        const t = a.bestEfforts[key]
        if (t !== undefined && (!winner || t < winner.bestEfforts[key]!)) winner = a
      }
      return { key, label: EFFORTS[key].label, time: winner?.bestEfforts[key], activity: winner }
    }),
  )

  const recordTitle = (a: Activity) => {
    const hit = recordsOf(a)[0]
    return hit ? `Record sur ${hit.label} : ${formatDuration(hit.time)}` : undefined
  }

  return { recordsOf, bests, recordTitle }
}
