/*
 * Courbes d'une course (temps, cardio, vitesse, distance), réduites pour l'affichage.
 * Logique pure, testée (tests/streams.test.ts).
 */
import type { Lap } from './compliance'

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

/**
 * Courbes vraisemblables fabriquées à partir des tours (démo) : la vitesse suit chaque tour, la FC
 * tend vers celle du tour avec un temps de réponse d'une trentaine de secondes (elle monte pendant
 * les efforts, redescend en récup). Déterministe pour une même « seed ».
 */
export function streamFromLaps(laps: Lap[], seed = 1, n = 240): RunStream {
  const list = (Array.isArray(laps) ? laps : []).filter((l) => l && l.sec > 0)
  if (!list.length) return { t: [], hr: null, v: null, d: null }
  let h = seed >>> 0 || 1
  const rand = () => ((h = (Math.imul(h ^ (h >>> 15), 2246822507) + 0x9e3779b9) >>> 0), (h % 10000) / 10000)
  const withHr = list.some((l) => l.hr)
  const t: number[] = []
  const hr: number[] = []
  const v: number[] = []
  const d: number[] = []
  const step = 5
  let time = 0
  let dist = 0
  let heart = (list.find((l) => l.hr)?.hr ?? 120) - 25
  for (const l of list) {
    const speed = l.m / l.sec
    const target = l.hr ?? heart
    for (let s = 0; s < l.sec; s += step) {
      const dt = Math.min(step, l.sec - s)
      time += dt
      dist += speed * dt
      // Réponse du cœur : rapprochement progressif de la FC du tour, avec un léger bruit
      heart += (target + 4 - heart) * (1 - Math.exp(-dt / 30))
      t.push(time)
      d.push(dist)
      v.push(Math.max(0, speed * (1 + (rand() - 0.5) * 0.06)))
      hr.push(heart + (rand() - 0.5) * 3)
    }
  }
  const round = (a: number[], k = 1) => downsample(a, n).map((x) => Math.round(x * k) / k)
  return { t: round(t), hr: withHr ? round(hr) : null, v: round(v, 100), d: round(d) }
}
