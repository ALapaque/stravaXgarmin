/** Tracés GPS : décodage des polylines Strava et parcours inventés pour la démo. */

export type Pt = [number, number]

/** Décode une polyline encodée (format Google, utilisé par Strava). */
export function decodePolyline(str: string): Pt[] {
  const pts: Pt[] = []
  let i = 0
  let lat = 0
  let lng = 0
  while (i < str.length) {
    for (const axis of [0, 1]) {
      let shift = 0
      let result = 0
      let b: number
      do {
        b = str.charCodeAt(i++) - 63
        result |= (b & 0x1f) << shift
        shift += 5
      } while (b >= 0x20 && i < str.length)
      const d = result & 1 ? ~(result >> 1) : result >> 1
      if (axis === 0) lat += d
      else lng += d
    }
    pts.push([lat / 1e5, lng / 1e5])
  }
  return pts
}

function hash(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

/** Parcours imaginaire mais crédible (boucle irrégulière), stable pour un même identifiant. */
export function demoRoute(seed: string, kind: string): Pt[] {
  let h = hash(seed)
  const rand = () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0), (h % 10000) / 10000)
  if (kind === 'interval') {
    // Piste : ovale de 400 m
    return Array.from({ length: 64 }, (_, k) => {
      const t = (k / 63) * Math.PI * 2
      const x = Math.cos(t)
      return [Math.sin(t) * 0.55, x > 0 ? x * 0.4 + 0.6 : x * 0.4 - 0.6] as Pt
    })
  }
  const n = 90
  const lobes = 2 + Math.floor(rand() * 3)
  const phase = rand() * Math.PI * 2
  const stretch = 0.6 + rand() * 0.8
  const pts: Pt[] = []
  for (let k = 0; k <= n; k++) {
    const t = (k / n) * Math.PI * 2
    const r = 1 + 0.28 * Math.sin(lobes * t + phase) + 0.12 * Math.sin(5 * t + phase * 2) + (rand() - 0.5) * 0.05
    pts.push([Math.sin(t) * r, Math.cos(t) * r * stretch])
  }
  if (kind === 'long' || kind === 'tempo') {
    // Aller-retour avec une boucle au bout
    return [...pts.slice(0, n * 0.7).map(([a, b]) => [a * 1.4 + 0.3, b] as Pt)]
  }
  return pts
}

/** Chemin SVG centré dans un carré de `size`, latitude corrigée pour ne pas étirer le tracé. */
export function routePath(pts: Pt[], size = 100, pad = 8) {
  if (pts.length < 2) return ''
  const lat0 = (pts.reduce((s, p) => s + p[0], 0) / pts.length) * (Math.PI / 180)
  const k = Math.abs(lat0) > 1e-3 && Math.abs(lat0) < 1.5 ? Math.cos(lat0) : 1
  const xy = pts.map(([la, lo]) => [lo * k, -la] as Pt)
  const xs = xy.map((p) => p[0])
  const ys = xy.map((p) => p[1])
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  const span = Math.max(maxX - minX, maxY - minY) || 1
  const scale = (size - pad * 2) / span
  const ox = (size - (maxX - minX) * scale) / 2
  const oy = (size - (maxY - minY) * scale) / 2
  // Un point sur deux suffit pour les longs tracés
  const step = xy.length > 400 ? Math.ceil(xy.length / 400) : 1
  return xy
    .filter((_, i) => i % step === 0 || i === xy.length - 1)
    .map(([x, y], i) => `${i ? 'L' : 'M'}${(ox + (x - minX) * scale).toFixed(1)} ${(oy + (y - minY) * scale).toFixed(1)}`)
    .join('')
}

/** Points du tracé ajustés dans un rectangle (pour dessiner sur un canvas), proportions gardées. */
export function fitRoute(pts: Pt[], w: number, h: number): Pt[] {
  if (pts.length < 2) return []
  const lat0 = (pts.reduce((s, p) => s + p[0], 0) / pts.length) * (Math.PI / 180)
  const k = Math.abs(lat0) > 1e-3 && Math.abs(lat0) < 1.5 ? Math.cos(lat0) : 1
  const xy = pts.map(([la, lo]) => [lo * k, -la] as Pt)
  const xs = xy.map((p) => p[0])
  const ys = xy.map((p) => p[1])
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]
  const scale = Math.min(w / (maxX - minX || 1), h / (maxY - minY || 1))
  const ox = (w - (maxX - minX) * scale) / 2
  const oy = (h - (maxY - minY) * scale) / 2
  return xy.map(([x, y]) => [ox + (x - minX) * scale, oy + (y - minY) * scale])
}
