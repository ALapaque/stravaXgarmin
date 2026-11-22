/* Règles de nommage : la logique pure vit dans shared/utils/naming.ts. */
import type { Activity } from './useActivities'

export function useNaming() {
  const settings = useSettings()
  const ruleTitle = (a: Activity) => renderTemplate(a, settings.value.naming.templates[a.type])
  return { ruleTitle }
}
