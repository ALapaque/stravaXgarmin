/* Description enrichie : le texte est construit dans shared/utils/description.ts. */
import type { Activity } from './useActivities'

export function useDescription() {
  const settings = useSettings()
  // Ancienne description enrichie, remplacée par le Débrief : seulement chiffres, chaussures et signature
  const describe = (a: Activity) => {
    const p = partsOf(settings.value.description)
    return buildDescription(a, { weather: false, splits: p.numbers, shoes: p.shoes, signature: p.signature })
  }
  return { describe }
}
