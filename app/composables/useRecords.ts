import type { Activity, EffortKey } from './useActivities'

export const EFFORTS: Record<EffortKey, { label: string }> = {
  '5k': { label: '5 km' },
  '10k': { label: '10 km' },
  half: { label: 'Semi' },
  marathon: { label: 'Marathon' },
}

export interface RecordHit {
  key: EffortKey
  label: string
  time: number
  /** Ancien record battu, si il y en avait un */
  previous?: number
}

/** Records de tous les temps lus dans Garmin Connect (gardés dans le navigateur). */
export interface GarminRecord {
  key: string
  value: number
  activityId?: number
  activityName?: string
  date?: string
}

export function useGarminRecords() {
  return useState<{ at: string; list: GarminRecord[] } | null>('garminRecords', () => null)
}

/**
 * Records personnels.
 * - Tes records de tous les temps : ceux de Garmin Connect quand il est connecté,
 *   sinon les meilleurs efforts des courses chargées.
 * - Record battu par une course : Strava le signale (pr_rank), sinon on compare aux courses d'avant.
 */
export function useRecords() {
  const { activities } = useActivities()
  const garmin = useGarminRecords()

  const chrono = computed(() => [...activities.value].sort((a, b) => a.startedAt.localeCompare(b.startedAt)))

  const hitsById = computed(() => {
    const best: Partial<Record<EffortKey, number>> = {}
    const map = new Map<string, RecordHit[]>()
    const add = (a: Activity, hit: RecordHit) => {
      const list = map.get(a.id) ?? []
      if (!list.some((h) => h.key === hit.key)) list.push(hit)
      map.set(a.id, list)
    }
    for (const a of chrono.value) {
      for (const key of Object.keys(EFFORTS) as EffortKey[]) {
        const t = a.bestEfforts[key]
        if (t === undefined) continue
        const prev = best[key]
        const faster = prev === undefined || t < prev
        // Strava sait si c'est un record de tous les temps ; sinon, seulement battre un effort déjà connu compte
        if (a.prs?.includes(key)) add(a, { key, label: EFFORTS[key].label, time: t, previous: prev })
        else if (faster && prev !== undefined && !a.stravaId) add(a, { key, label: EFFORTS[key].label, time: t, previous: prev })
        if (faster) best[key] = t
      }
      // Record de tous les temps chez Garmin réalisé pendant cette course
      for (const r of garmin.value?.list ?? []) {
        if (r.key in EFFORTS && r.activityId && r.activityId === a.garminId) {
          const key = r.key as EffortKey
          add(a, { key, label: EFFORTS[key].label, time: Math.round(r.value) })
        }
      }
    }
    return map
  })

  const recordsOf = (a: Activity) => hitsById.value.get(a.id) ?? []

  /** Meilleur temps actuel pour chaque distance */
  const bests = computed(() =>
    (Object.keys(EFFORTS) as EffortKey[]).map((key) => {
      const g = garmin.value?.list.find((r) => r.key === key)
      if (g) {
        const activity = activities.value.find((a) => a.garminId && a.garminId === g.activityId)
        return { key, label: EFFORTS[key].label, time: Math.round(g.value), activity, name: g.activityName, date: g.date, source: 'garmin' as const }
      }
      let winner: Activity | undefined
      for (const a of activities.value) {
        const t = a.bestEfforts[key]
        if (t !== undefined && (!winner || t < winner.bestEfforts[key]!)) winner = a
      }
      return {
        key,
        label: EFFORTS[key].label,
        time: winner?.bestEfforts[key],
        activity: winner,
        name: winner ? displayTitle(winner).title : undefined,
        date: winner?.startedAt,
        source: 'courses' as const,
      }
    }),
  )

  const fromGarmin = computed(() => Boolean(garmin.value?.list.length))

  const recordTitle = (a: Activity) => {
    const hit = recordsOf(a)[0]
    return hit ? `Record sur ${hit.label} : ${formatDuration(hit.time)}` : undefined
  }

  return { recordsOf, bests, recordTitle, fromGarmin }
}
