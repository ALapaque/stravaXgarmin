/*
 * Texte que l'appli propose d'ajouter à la description Strava.
 * Logique pure, testée (tests/description.test.ts).
 */

export interface DescriptionOptions {
  weather: boolean
  splits: boolean
  shoes: boolean
  signature: boolean
}

/** Ce dont le texte a besoin : une activité de l'appli convient telle quelle. */
export interface DescriptionInput {
  weather?: { tempC: number; sky: string; windKmh: number }
  splits: number[]
  shoe?: { name: string; km: number }
}

function shortPace(sec: number) {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
}

/** Texte ajouté à la description Strava. */
export function buildDescription(a: DescriptionInput, o: DescriptionOptions) {
  const lines: string[] = []
  if (o.weather && a.weather) lines.push(`Météo : ${a.weather.tempC} °C, ${a.weather.sky}, vent ${a.weather.windKmh} km/h`)
  if (o.splits && a.splits.length) lines.push(`Km : ${a.splits.map(shortPace).join(' · ')}`)
  if (o.shoes && a.shoe) lines.push(`Chaussures : ${a.shoe.name} (${a.shoe.km} km)`)
  if (o.signature && lines.length) lines.push('— via stravaXgarmin')
  return lines.join('\n')
}

/* ───── Fusion avec la description existante ───── */

/** Longueur maximale d'une description Strava. */
export const MAX_DESCRIPTION = 5000

/** Place minimale pour un bloc raccourci : en dessous, on n'ajoute rien plutôt qu'un bout illisible. */
const MIN_BLOCK = 40

export type MergeChange = 'added' | 'replaced' | 'removed' | 'none' | 'full'

/**
 * Fins de ligne « \r\n » (renvoyées par Strava) ramenées à « \n ».
 * Toute comparaison entre une description et un bloc se fait sur du texte passé par ici.
 */
export function normalizeNewlines(text: string | null | undefined): string {
  return (text ?? '').replace(/\r\n?/g, '\n')
}

/** Le bloc de l'appli figure-t-il tel quel dans la description ? (fins de ligne ignorées) */
export function hasBlock(description: string | null | undefined, block: string | null | undefined): boolean {
  const b = normalizeNewlines(block).trim()
  return Boolean(b) && normalizeNewlines(description).includes(b)
}

/**
 * Place le texte de l'appli (« block ») dans la description actuelle (« current ») sans jamais toucher au texte
 * de l'utilisateur : ajouté à la suite, ou mis à la place du bloc que l'appli avait publié avant (« previous »),
 * ou retiré quand « block » est vide. « block » dans le résultat : le texte réellement placé (raccourci si besoin).
 */
export function mergeDescription(
  current: string | null | undefined,
  block: string,
  previous?: string | null,
  max = MAX_DESCRIPTION,
): { text: string; change: MergeChange; block: string } {
  const cur = normalizeNewlines(current)
  const add = normalizeNewlines(block).trim()
  const prev = normalizeNewlines(previous).trim()
  const none = { text: cur, change: 'none' as const, block: '' }

  // Texte final = avant + bloc + après ; le bloc est raccourci (jamais le texte de l'utilisateur) s'il dépasse
  const fit = (before: string, after: string, change: 'added' | 'replaced') => {
    if (before.length + add.length + after.length <= max) return { text: before + add + after, change, block: add }
    const room = max - before.length - after.length
    if (room < MIN_BLOCK) return { text: cur, change: 'full' as const, block: '' }
    const short = `${add.slice(0, room - 1).trimEnd()}…`
    return { text: before + short + after, change, block: short }
  }

  const at = prev ? cur.lastIndexOf(prev) : -1
  if (at >= 0) {
    let before = cur.slice(0, at)
    let after = cur.slice(at + prev.length)
    if (!add) {
      // Retrait : le bloc part avec la ligne vide qui le séparait du reste
      if (/\n\n$/.test(before)) before = before.slice(0, -2)
      else if (!before && /^\n\n/.test(after)) after = after.slice(2)
      else if (/\n$/.test(before)) before = before.slice(0, -1)
      else if (!before && /^\n/.test(after)) after = after.slice(1)
      const text = before + after
      return { text: text.trim() ? text : '', change: 'removed', block: '' }
    }
    if (add === prev) return none
    return fit(before, after, 'replaced')
  }

  if (!add) return none
  if (!cur.trim()) return fit('', '', 'added')
  if (cur.includes(add)) return none // appuyer deux fois ne double rien
  return fit(`${cur.trimEnd()}\n\n`, '', 'added')
}
