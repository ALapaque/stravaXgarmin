/*
 * Débriefs des courses : issue de la séance, ressenti, note, séance choisie à la main.
 * Gardés dans le navigateur (état « debriefs »). Règles dans shared/utils/debrief.ts.
 */
import type { Debrief } from '#shared/utils/debrief'

export type { Debrief }

/** État gardé : un débrief par course. */
export const useDebriefState = () => useState<Record<string, Debrief>>('debriefs', () => (isDemoCookie() ? demoData().debriefs : {}))

export function useDebriefs() {
  const debriefs = useDebriefState()
  const settings = useSettings()
  const { sorted } = useActivities()
  const convention = useConvention()
  const { active: demo } = useDemo()

  /** Seules les courses après cette date réclament un débrief (les vieilles courses ne réclament rien). En démo : la course d'hier. */
  const since = computed(() => (demo.value ? demoBase().debriefSince : settings.value.debriefSince || ''))

  const get = (id: string): Debrief | null => debriefs.value?.[id] ?? null

  /** Fusionne une modification dans le débrief de la course et date la modification. */
  function save(id: string, patch: Partial<Debrief>) {
    debriefs.value = { ...debriefs.value, [id]: mergeDebrief(debriefs.value?.[id], patch, new Date().toISOString()) }
    return debriefs.value[id]!
  }

  /** « Plus tard / pas besoin » : la course ne réclame plus de débrief. */
  const skip = (id: string) => save(id, { status: 'skipped' })

  /** Courses à débriefer, la plus récente d'abord. */
  const toDebrief = computed(() =>
    sorted.value.filter((a) => needsDebrief(a, debriefs.value, { since: since.value, convention: convention.enabled.value })),
  )

  return { debriefs, since, get, save, skip, toDebrief }
}
