/* Description enrichie : le texte est construit dans shared/utils/description.ts. */
import type { Activity } from './useActivities'

export function useDescription() {
  const settings = useSettings()
  const describe = (a: Activity) => buildDescription(a, settings.value.description)
  return { describe }
}
