/*
 * Séances planifiées dans le calendrier Garmin Connect (API non officielle) : passées (35 jours) et à venir.
 * Kiprun Pacer n'a pas d'API : ses séances arrivent ici quand on les exporte vers Garmin
 * (bouton « Exporter » dans Pacer). Les plans Garmin Coach et les séances ajoutées à la main aussi.
 *
 * Les séances passées ne changent plus : le navigateur envoie celles qu'il a déjà (« ?known=id1,id2 »),
 * elles reviennent en forme réduite et seules les autres sont relues (8 au plus par passage, les plus récentes d'abord).
 * Les séances à venir (12 au plus) sont toujours relues. Jamais plus de 6 appels Garmin à la fois.
 */

// Une fonction serveur a peu de temps pour répondre : 20 séances lues au plus par passage, 6 à la fois
// (la version précédente en lisait 12 d'un coup sans souci). Le reste vient à la lecture suivante.
const PAST_PER_CALL = 8
const PARALLEL = 6
interface CalendarItem {
  id: number
  itemType?: string
  title?: string
  date?: string
  workoutId?: number | null
  sportTypeKey?: string | null
  trainingPlanId?: number | null
}

interface WorkoutDetail {
  workoutName?: string
  description?: string | null
  workoutProvider?: string | null
  estimatedDurationInSecs?: number | null
  estimatedDistanceInMeters?: number | null
  sportType?: { sportTypeKey?: string }
  workoutSegments?: { workoutSteps?: unknown[] }[]
}

function today() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Brussels' }).format(new Date())
}

/** Exécute « fn » sur chaque élément, « limit » à la fois au plus, en gardant l'ordre. */
async function pool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  const worker = async () => {
    while (next < items.length) {
      const i = next++
      out[i] = await fn(items[i]!)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return out
}

const validId = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) && v > 0 ? v : null)

export default defineEventHandler(async (event) => {
  const gc = await garminClient(event)
  const known = new Set(String(getQuery(event).known ?? '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 200))
  const now = new Date()
  const months = [-1, 0, 1].map((k) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + k, 1))
    return { y: d.getUTCFullYear(), m: d.getUTCMonth() } // l'API Garmin compte les mois à partir de 0
  })
  // Un mois illisible n'empêche pas de lire les autres ; tous illisibles : l'erreur remonte (état des connexions)
  const settled = await Promise.allSettled(
    months.map(({ y, m }) => garminCall(() => gc.get<{ calendarItems?: CalendarItem[] }>(`https://connectapi.garmin.com/calendar-service/year/${y}/month/${m}`))),
  )
  if (settled.every((r) => r.status === 'rejected')) throw (settled[0] as PromiseRejectedResult).reason
  const cals = settled.map((r) => (r.status === 'fulfilled' ? r.value : undefined))

  const day = today()
  const from = shiftDay(day, -PLAN_PAST_DAYS)
  // Un mois du calendrier Garmin déborde sur les semaines voisines : la même séance revient
  // dans deux mois. On garde une seule fois chaque séance (même id, ou même jour et même nom).
  const seen = new Set<string>()
  const items = cals
    .flatMap((c) => (Array.isArray(c?.calendarItems) ? c.calendarItems : []))
    .filter((i) => i && i.itemType === 'workout' && typeof i.date === 'string' && i.date >= from && (!i.sportTypeKey || /run/i.test(i.sportTypeKey)))
    .filter((i) => {
      const keys = [`id:${i.id}`, `day:${i.date}|${(i.title ?? '').trim().toLowerCase()}|${i.workoutId ?? ''}`]
      if (keys.some((k) => seen.has(k))) return false
      keys.forEach((k) => seen.add(k))
      return true
    })
    .sort((a, b) => a.date!.localeCompare(b.date!))

  const upcoming = items.filter((i) => i.date! >= day).slice(0, 12)
  const past = items.filter((i) => i.date! < day).reverse() // les plus récentes d'abord
  const pastKnown = past.filter((i) => known.has(String(i.id)))
  const pastUnknown = past.filter((i) => !known.has(String(i.id)))
  const toRead = pastUnknown.slice(0, PAST_PER_CALL)
  const later = pastUnknown.slice(PAST_PER_CALL)

  /** Séance lue en détail ; un détail illisible donne quand même le titre et la date, steps: []. */
  async function read(i: CalendarItem) {
    const workoutId = validId(i.workoutId)
    let w: WorkoutDetail | undefined
    if (workoutId) {
      w = await gc.get<WorkoutDetail>(`https://connectapi.garmin.com/workout-service/workout/${workoutId}`).catch(() => undefined)
    }
    const segments = Array.isArray(w?.workoutSegments) ? w.workoutSegments : []
    let walked: ReturnType<typeof walkGarminSteps> = { lines: [], blocks: [], steps: [] }
    try {
      walked = walkGarminSteps(segments.flatMap((s) => (Array.isArray(s?.workoutSteps) ? s.workoutSteps : [])))
    } catch {
      // Forme inattendue : la séance sort sans étapes
    }
    const est = walked.blocks.reduce((s, b) => s + b.sec, 0)
    return {
      id: String(i.id),
      date: i.date!,
      title: (typeof w?.workoutName === 'string' && w.workoutName) || i.title || 'Séance',
      description: typeof w?.description === 'string' ? w.description : null,
      provider: typeof w?.workoutProvider === 'string' ? w.workoutProvider : null,
      durationSec: validId(Math.round(Number(w?.estimatedDurationInSecs))) || est || null,
      distanceM: typeof w?.estimatedDistanceInMeters === 'number' && w.estimatedDistanceInMeters > 0 ? w.estimatedDistanceInMeters : null,
      workoutId,
      lines: walked.lines,
      blocks: walked.blocks,
      steps: walked.steps,
    }
  }

  const detailed = await pool([...upcoming, ...toRead], PARALLEL, read)
  const reduced = pastKnown.map((i) => ({ id: String(i.id), date: i.date!, title: i.title || 'Séance', workoutId: validId(i.workoutId), known: true as const }))
  // Au-delà de ce qu'un passage peut lire : titre et date seulement, relues au prochain passage
  const pending = later.map((i) => ({
    id: String(i.id),
    date: i.date!,
    title: i.title || 'Séance',
    description: null,
    provider: null,
    durationSec: null,
    distanceM: null,
    workoutId: validId(i.workoutId),
    lines: [],
    blocks: [],
    steps: [],
    pending: true,
  }))
  return [...detailed, ...reduced, ...pending].sort((a, b) => a.date.localeCompare(b.date))
})
