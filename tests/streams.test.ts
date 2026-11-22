import { describe, expect, it } from 'vitest'
import { downsample, streamFromLaps, toRunStream } from '../shared/utils/streams'

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

describe('streamFromLaps', () => {
  const lap = (m: number, sec: number, hr: number | null) => ({ m, sec, elapsedSec: sec, hr, maxHr: hr })
  it('la FC monte pendant l’effort et redescend en récup, la vitesse suit les tours', () => {
    const s = streamFromLaps([lap(1000, 360, 130), lap(400, 100, 175), lap(200, 90, 135)], 7, 1000)
    const at = (sec: number) => s.t.findIndex((x) => x >= sec)
    expect(s.hr![at(455)]!).toBeGreaterThan(s.hr![at(355)]! + 20)
    expect(s.hr![at(545)]!).toBeLessThan(s.hr![at(455)]! - 10)
    expect(s.v![at(400)]!).toBeGreaterThan(s.v![at(200)]! * 1.2)
    expect(s.d![s.d!.length - 1]).toBeCloseTo(1600, 0)
    expect(s.t[s.t.length - 1]).toBe(550)
  })
  it('déterministe ; sans cardio : hr null ; sans tours : vide', () => {
    const laps = [lap(1000, 300, 150)]
    expect(streamFromLaps(laps, 3)).toEqual(streamFromLaps(laps, 3))
    expect(streamFromLaps([lap(1000, 300, null)]).hr).toBeNull()
    expect(streamFromLaps([])).toEqual({ t: [], hr: null, v: null, d: null })
  })
})
