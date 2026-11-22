/*
 * Séances du plan, passées et à venir : lues dans le calendrier Garmin (séances Kiprun exportées vers Garmin,
 * plans Garmin Coach, séances ajoutées à la main). Gardées dans le navigateur entre deux visites.
 * Relie aussi chaque course à sa séance et compare prévu et réalisé (logique dans shared/utils/).
 */
import type { PlanSession } from '#shared/utils/model'
import { adherence as planAdherence } from '#shared/utils/planmatch'
import type { Activity } from './useActivities'
// Forme des séances : shared/utils/model.ts (partagée avec le serveur, la mise à niveau et la démo)
export type { PlanBlock, PlanKind, PlanLine, PlanSession } from '#shared/utils/model'

const demoPlan = (): PlanSession[] => demoData().plan

export function usePlan() {
  const state = useState<{ at: string; list: PlanSession[] } | null>('plan', () => (isDemoCookie() ? { at: '', list: demoPlan() } : null))
  const list = computed(() => state.value?.list ?? [])
  const upcoming = computed(() => list.value.filter((s) => s.date >= TODAY))
  const next = computed(() => upcoming.value[0])
  /** Séances passées, la plus récente d'abord */
  const past = computed(() => list.value.filter((s) => s.date < TODAY).reverse())
  const byId = (id: string) => list.value.find((s) => s.id === id)

  /*
   * Calendrier Garmin relu au plus toutes les 10 minutes. Les séances passées déjà connues ne sont pas
   * relues en détail (le serveur les renvoie en forme réduite) ; un plan gardé sans étapes (version
   * précédente) a perdu sa date de lecture et est relu tout de suite.
   */
  async function load(force = false) {
    const at = state.value?.at
    if (!force && at && Date.now() - Date.parse(at) < 10 * 60_000) return
    const known = knownIds(list.value, TODAY)
    const fresh = await useHealth().track(
      'garmin.plan',
      () => $fetch<unknown[]>('/api/garmin/plan', { query: known.length ? { known: known.join(',') } : {} }),
      (l) => {
        const merged = mergePlan(list.value, Array.isArray(l) ? l : [], TODAY)
        return HEALTH_INFO.plan(merged.filter((s) => s.date >= TODAY).length, merged.filter((s) => s.date < TODAY).length)
      },
    )
    state.value = { at: new Date().toISOString(), list: mergePlan(list.value, Array.isArray(fresh) ? fresh : [], TODAY) }
  }

  function reset(demo: boolean) {
    state.value = demo ? { at: '', list: demoPlan() } : null
  }

  /* ───── Courses reliées aux séances ───── */

  const { activities } = useActivities()
  const debriefs = useDebriefState()

  /** Choix manuels faits dans les débriefs : séance choisie, ou « séance libre » */
  const manual = computed(() => {
    const out: Record<string, string> = {}
    for (const [id, d] of Object.entries(debriefs.value ?? {})) if (d?.planId) out[id] = d.planId
    return out
  })

  const match = computed(() =>
    matchPlan(
      activities.value.map((a) => ({ id: a.id, localDate: a.localDate, names: [a.stravaName, a.garminName], workoutId: a.garminWorkoutId ?? null })),
      list.value.filter((s) => !s.synthetic),
      manual.value,
      TODAY,
    ),
  )

  /**
   * Séance reliée à une course ; à défaut, une séance déduite du nom de la montre (« nom:<id> », synthetic).
   * « Séance libre » choisie dans le débrief : aucune.
   */
  function sessionFor(a: Activity): PlanSession | null {
    const id = match.value.byRun[a.id]
    if (id) return byId(id) ?? null
    if (manual.value[a.id] === 'none') return null
    // Sans activité Garmin reliée, « garminName » n'est qu'une copie du titre Strava : ce n'est pas un nom de montre
    return syntheticSession({
      id: a.id,
      localDate: a.localDate,
      garminName: a.garminName,
      stravaName: a.stravaName,
      fromWatch: Boolean(a.garminId) || a.garminName !== a.stravaName,
      isRace: a.type === 'race',
    })
  }

  /** Prévu contre réalisé pour une course (null : rien de comparable, ou pas de séance). */
  function resultFor(a: Activity) {
    const s = sessionFor(a)
    if (!s) return null
    return comparePlan(s, { durationSec: a.durationSec, distanceM: a.distanceKm * 1000, laps: a.laps })
  }

  /** Identifiants des séances du plan reliées à une course (faites) */
  const done = computed(() => Object.values(match.value.byRun))

  /** Séances passées sans course, la plus récente d'abord */
  const skipped = computed(() => {
    const ids = new Set(match.value.skipped)
    return past.value.filter((s) => ids.has(s.id))
  })

  /** Suivi du plan sur 8 semaines ; l'issue choisie dans le débrief passe avant celle calculée. */
  const adherence = computed(() => {
    const outcomes: Record<string, Outcome | null> = {}
    for (const runId of Object.keys(match.value.byRun)) {
      const a = activities.value.find((x) => x.id === runId)
      outcomes[runId] = debriefs.value?.[runId]?.outcome ?? (a ? (resultFor(a)?.outcome ?? null) : null)
    }
    return planAdherence(list.value.filter((s) => !s.synthetic), match.value.byRun, outcomes, TODAY)
  })

  return { state, list, upcoming, next, past, byId, load, reset, sessionFor, resultFor, skipped, done, adherence }
}

/** « Demain », « Jeudi 20 nov. »… */
export function planDay(date: string) {
  const diff = Math.round((Date.parse(`${date}T12:00:00Z`) - Date.parse(`${TODAY}T12:00:00Z`)) / 86_400_000)
  if (diff === 0) return 'Aujourd’hui'
  if (diff === 1) return 'Demain'
  const s = new Intl.DateTimeFormat('fr-BE', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`))
  return s.charAt(0).toUpperCase() + s.slice(1)
}
