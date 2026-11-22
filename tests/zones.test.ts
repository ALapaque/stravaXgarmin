import { describe, expect, it } from 'vitest'
import { estimateHrMax, hrZones, timeInZones } from '../shared/utils/zones'

describe('zones cardio', () => {
  it('hrZones : 50–60–70–80–90–100 %', () => {
    expect(hrZones(190)).toEqual([
      { z: 1, from: 95, to: 114, label: 'Très facile' },
      { z: 2, from: 114, to: 133, label: 'Endurance' },
      { z: 3, from: 133, to: 152, label: 'Tempo' },
      { z: 4, from: 152, to: 171, label: 'Seuil' },
      { z: 5, from: 171, to: 190, label: 'Maximum' },
    ])
  })

  it('timeInZones : secondes par zone, sous 50 % compté en zone 1', () => {
    const stream = { t: [0, 10, 20, 30, 40, 50], hr: [80, 80, 80, 140, 140, 185] }
    expect(timeInZones(stream, 200)).toEqual([20, 0, 20, 0, 10])
    expect(timeInZones({ t: [0, 10], hr: null }, 190)).toBeNull()
    expect(timeInZones(stream, null)).toBeNull()
  })

  it('estimateHrMax : la plus haute vue, au moins 3 courses avec cardio', () => {
    expect(estimateHrMax([{ maxHr: 181 }, { maxHr: 176 }, {}, { maxHr: 188 }])).toBe(188)
    expect(estimateHrMax([{ maxHr: 181 }, { maxHr: 0 }, {}])).toBeNull()
  })
})
