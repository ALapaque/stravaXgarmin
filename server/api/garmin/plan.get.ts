/*
 * Prochaines séances planifiées dans le calendrier Garmin Connect (API non officielle).
 * Kiprun Pacer n'a pas d'API : ses séances arrivent ici quand on les exporte vers Garmin
 * (bouton « Exporter » dans Pacer). Les plans Garmin Coach et les séances ajoutées à la main aussi.
 */
interface CalendarItem {
  id: number
  itemType?: string
  title?: string
  date?: string
  workoutId?: number | null
  sportTypeKey?: string | null
  trainingPlanId?: number | null
}

interface Step {
  type?: string
  stepType?: { stepTypeKey?: string }
  description?: string | null
  endCondition?: { conditionTypeKey?: string } | null
  endConditionValue?: number | null
  targetType?: { workoutTargetTypeKey?: string } | null
  targetValueOne?: number | null
  targetValueTwo?: number | null
  zoneNumber?: number | null
  numberOfIterations?: number | null
  workoutSteps?: Step[]
}

interface WorkoutDetail {
  workoutName?: string
  description?: string | null
  workoutProvider?: string | null
  estimatedDurationInSecs?: number | null
  estimatedDistanceInMeters?: number | null
  sportType?: { sportTypeKey?: string }
  workoutSegments?: { workoutSteps?: Step[] }[]
}

type Kind = 'warmup' | 'cooldown' | 'interval' | 'recovery' | 'rest' | 'other'

export interface PlanBlock {
  kind: Kind
  sec: number
  /** Intensité relative 0..1 pour le profil de la séance */
  level: number
}

export interface PlanLine {
  kind: Kind | 'repeat'
  text: string
  reps?: number
  children?: PlanLine[]
}

const KINDS: Record<string, Kind> = { warmup: 'warmup', cooldown: 'cooldown', interval: 'interval', recovery: 'recovery', rest: 'rest' }
const LABEL: Record<Kind, string> = {
  warmup: 'Échauffement',
  cooldown: 'Retour au calme',
  interval: 'Effort',
  recovery: 'Récup',
  rest: 'Repos',
  other: 'Course',
}

const pace = (ms: number) => {
  const s = Math.round(1000 / ms)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
const dur = (s: number) => (s >= 60 ? `${Math.round(s / 60)} min${s % 60 && s < 600 ? ` ${s % 60} s` : ''}` : `${s} s`)
const dist = (m: number) => (m >= 1000 ? `${(m / 1000).toLocaleString('fr-BE', { maximumFractionDigits: 2 })} km` : `${Math.round(m)} m`)

function target(s: Step) {
  const t = s.targetType?.workoutTargetTypeKey
  const a = s.targetValueOne ?? 0
  const b = s.targetValueTwo ?? 0
  if (t === 'pace.zone' && a && b) return { text: `${pace(Math.max(a, b))}–${pace(Math.min(a, b))} /km`, ms: (a + b) / 2 }
  if (t === 'heart.rate.zone') {
    if (a && b) return { text: `${Math.round(Math.min(a, b))}–${Math.round(Math.max(a, b))} bpm` }
    if (s.zoneNumber) return { text: `zone ${s.zoneNumber} cardio` }
  }
  return undefined
}

function kindOf(s: Step): Kind {
  return KINDS[s.stepType?.stepTypeKey ?? ''] ?? 'other'
}

const BASE_LEVEL: Record<Kind, number> = { warmup: 0.42, cooldown: 0.38, interval: 0.9, recovery: 0.28, rest: 0.18, other: 0.6 }

function walk(steps: Step[], blocks: PlanBlock[], depth = 0): PlanLine[] {
  const lines: PlanLine[] = []
  for (const s of steps) {
    if (s.workoutSteps?.length && (s.numberOfIterations ?? 0) > 0) {
      const reps = s.numberOfIterations ?? 1
      const inner: PlanBlock[] = []
      const children = walk(s.workoutSteps, inner, depth + 1)
      for (let i = 0; i < Math.min(reps, 30); i++) blocks.push(...inner)
      lines.push({ kind: 'repeat', reps, text: `${reps} ×`, children })
      continue
    }
    const kind = kindOf(s)
    const cond = s.endCondition?.conditionTypeKey
    const v = s.endConditionValue ?? 0
    const tg = target(s)
    const parts: string[] = []
    let sec = 0
    if (cond === 'time' && v) {
      parts.push(dur(v))
      sec = v
    } else if (cond === 'distance' && v) {
      parts.push(dist(v))
      sec = v / (tg?.ms ?? 2.8)
    } else {
      parts.push(cond === 'lap.button' ? 'jusqu’au tour' : '')
      sec = kind === 'interval' ? 180 : 300
    }
    if (tg) parts.push(`à ${tg.text}`)
    // Une allure cible rapide pousse la barre plus haut
    const level = tg?.ms ? Math.min(1, Math.max(0.2, (tg.ms - 2) / 3)) : BASE_LEVEL[kind]
    blocks.push({ kind, sec: Math.round(sec), level })
    const text = [LABEL[kind], parts.filter(Boolean).join(' ')].filter(Boolean).join(' · ')
    lines.push({ kind, text: s.description ? `${text} — ${String(s.description).slice(0, 80)}` : text })
  }
  return lines
}

function today() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Brussels' }).format(new Date())
}

export default defineEventHandler(async (event) => {
  const gc = await garminClient(event)
  const now = new Date()
  const months = [0, 1].map((k) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + k, 1))
    return { y: d.getUTCFullYear(), m: d.getUTCMonth() } // l'API Garmin compte les mois à partir de 0
  })
  const cals = await Promise.all(
    months.map(({ y, m }) => garminCall(() => gc.get<{ calendarItems?: CalendarItem[] }>(`https://connectapi.garmin.com/calendar-service/year/${y}/month/${m}`))),
  )
  const from = today()
  // Un mois du calendrier Garmin déborde sur les semaines voisines : la même séance revient
  // dans les deux mois. On garde une seule fois chaque séance (même id, ou même jour et même nom).
  const seen = new Set<string>()
  const items = cals
    .flatMap((c) => c?.calendarItems ?? [])
    .filter((i) => i.itemType === 'workout' && i.date && i.date >= from && (!i.sportTypeKey || /run/i.test(i.sportTypeKey)))
    .filter((i) => {
      const keys = [`id:${i.id}`, `day:${i.date}|${(i.title ?? '').trim().toLowerCase()}|${i.workoutId ?? ''}`]
      if (keys.some((k) => seen.has(k))) return false
      keys.forEach((k) => seen.add(k))
      return true
    })
    .sort((a, b) => a.date!.localeCompare(b.date!))
    .slice(0, 12)

  return Promise.all(
    items.map(async (i) => {
      let w: WorkoutDetail | undefined
      if (i.workoutId) {
        w = await gc
          .get<WorkoutDetail>(`https://connectapi.garmin.com/workout-service/workout/${i.workoutId}`)
          .catch(() => undefined)
      }
      const blocks: PlanBlock[] = []
      const lines = walk(w?.workoutSegments?.flatMap((s) => s.workoutSteps ?? []) ?? [], blocks)
      const est = blocks.reduce((s, b) => s + b.sec, 0)
      return {
        id: String(i.id),
        date: i.date!,
        title: w?.workoutName || i.title || 'Séance',
        description: w?.description ?? null,
        provider: w?.workoutProvider ?? null,
        durationSec: w?.estimatedDurationInSecs || est || null,
        distanceM: w?.estimatedDistanceInMeters ?? null,
        lines,
        blocks: blocks.slice(0, 80),
      }
    }),
  )
})
