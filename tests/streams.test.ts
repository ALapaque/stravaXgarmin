import { describe, expect, it } from 'vitest'
import { downsample, toRunStream } from '../shared/utils/streams'

describe('downsample', () => {
  it('moyenne par paquet, premier et dernier points gardés', () => {
    const v = Array.from({ length: 1000 }, (_, i) => i)
    const d = downsample(v, 10)
    expect(d).toHaveLength(10)
    expect(d[0]).toBe(0)
    expect(d[9]).toBe(999)
    expect(d[1]).toBeCloseTo(149.5)
  })
  it('série courte inchangée', () => {
    expect(downsample([1, 2, 3], 240)).toEqual([1, 2, 3])
  })
})

describe('toRunStream', () => {
  it('séries Strava réduites ; une série absente vaut null', () => {
    const n = 3600
    const raw = {
      time: { data: Array.from({ length: n }, (_, i) => i) },
      heartrate: { data: Array.from({ length: n }, () => 150) },
      velocity_smooth: { data: Array.from({ length: n }, () => 2.777) },
    }
    const s = toRunStream(raw, 240)
    expect(s.t).toHaveLength(240)
    expect(s.hr).toHaveLength(240)
    expect(s.v![10]).toBe(2.78)
    expect(s.d).toBeNull()
  })
  it('réponse inattendue : vide, sans erreur', () => {
    expect(toRunStream(null)).toEqual({ t: [], hr: null, v: null, d: null })
    expect(toRunStream({ time: { data: 'x' } } as never)).toEqual({ t: [], hr: null, v: null, d: null })
  })
})
