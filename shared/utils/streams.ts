/*
 * Courbes d'une course (temps, cardio, vitesse, distance), réduites pour l'affichage.
 * Logique pure, testée (tests/streams.test.ts).
 */

/** Courbes d'une course : « v » en m/s ; une série absente vaut null. */
export interface RunStream {
  t: number[]
  hr: number[] | null
  v: number[] | null
  d: number[] | null
}

/**
 * Réduit une série à « n » points au plus, par moyenne de paquets réguliers.
 * Le premier et le dernier point gardent leur valeur exacte (début et fin de la course).
 */
export function downsample(values: number[], n: number): number[] {
  const L = values.length
  if (n <= 0) return []
  if (L <= n) return [...values]
  if (n === 1) return [values[0]!]
  const out: number[] = []
  for (let i = 0; i < n; i++) {
    const a = Math.floor((i * L) / n)
    const b = Math.max(a + 1, Math.floor(((i + 1) * L) / n))
    let s = 0
    for (let k = a; k < b; k++) s += values[k]!
    out.push(s / (b - a))
  }
  out[0] = values[0]!
  out[n - 1] = values[L - 1]!
  return out
}

type RawSeries = { data?: unknown } | undefined

const series = (s: RawSeries, len: number): number[] | null => {
  const d = s?.data
  if (!Array.isArray(d) || !d.length || d.length !== len) return null
  return d.map((v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0))
}

/**
 * Courbes Strava (« key_by_type=true » : { time: { data }, heartrate: { data }… }) → RunStream de « n » points au plus.
 * Lecture défensive : une série absente, vide ou de mauvaise longueur vaut null ; sans « time », tout est vide.
 */
export function toRunStream(raw: Record<string, RawSeries> | null | undefined, n = 240): RunStream {
  const time = raw?.time?.data
  if (!Array.isArray(time) || time.length < 2) return { t: [], hr: null, v: null, d: null }
  const t = series(raw!.time, time.length)!
  const round = (v: number[] | null, k = 1) => (v ? downsample(v, n).map((x) => Math.round(x * k) / k) : null)
  return {
    t: round(t)!,
    hr: round(series(raw!.heartrate, time.length)),
    v: round(series(raw!.velocity_smooth, time.length), 100),
    d: round(series(raw!.distance, time.length)),
  }
}
