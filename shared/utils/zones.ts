/*
 * Zones de fréquence cardiaque calculées depuis la FC max (50–60–70–80–90–100 %).
 * Strava ne donne pas les zones personnelles sans une autorisation que l'appli ne demande pas : on les calcule.
 * Logique pure, testée (tests/zones.test.ts).
 */

export type Zone = 1 | 2 | 3 | 4 | 5

export interface HrZone {
  z: Zone
  from: number
  to: number
  label: string
}

const LABELS = ['Très facile', 'Endurance', 'Tempo', 'Seuil', 'Maximum'] as const

/** Les 5 zones, en battements par minute. */
export function hrZones(maxHr: number): HrZone[] {
  return LABELS.map((label, i) => ({
    z: (i + 1) as Zone,
    from: Math.round(maxHr * (0.5 + i * 0.1)),
    to: Math.round(maxHr * (0.6 + i * 0.1)),
    label,
  }))
}

/** Zone d'une fréquence cardiaque ; sous 50 % : zone 1. */
export function zoneOf(hr: number, maxHr: number): Zone {
  const p = hr / maxHr
  if (p < 0.6) return 1
  if (p < 0.7) return 2
  if (p < 0.8) return 3
  if (p < 0.9) return 4
  return 5
}

/** Secondes passées dans chaque zone (index 0 = zone 1) ; null sans cardio ou sans FC max. */
export function timeInZones(stream: { t: number[]; hr: number[] | null } | null | undefined, maxHr: number | null | undefined): number[] | null {
  if (!stream?.hr?.length || !maxHr || maxHr <= 0 || !Array.isArray(stream.t)) return null
  const out = [0, 0, 0, 0, 0]
  let any = false
  for (let i = 1; i < stream.t.length && i < stream.hr.length; i++) {
    const dt = stream.t[i]! - stream.t[i - 1]!
    const hr = stream.hr[i]!
    if (!(dt > 0) || !(hr > 0)) continue
    out[zoneOf(hr, maxHr) - 1]! += dt
    any = true
  }
  return any ? out.map((s) => Math.round(s)) : null
}

/** FC max estimée : la plus haute vue ; null s'il y a moins de 3 courses avec cardio. */
export function estimateHrMax(runs: { maxHr?: number | null }[]): number | null {
  const seen = runs.map((r) => r.maxHr ?? 0).filter((v) => v > 0)
  return seen.length >= 3 ? Math.max(...seen) : null
}
