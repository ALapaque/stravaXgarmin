import { describe, expect, it } from 'vitest'
import { decodePolyline } from '../app/utils/route'

describe('decodePolyline', () => {
  it('polyline de référence de Google', () => {
    const pts = decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@')
    expect(pts).toEqual([
      [38.5, -120.2],
      [40.7, -120.95],
      [43.252, -126.453],
    ])
  })

  it('chaîne vide → aucun point', () => {
    expect(decodePolyline('')).toEqual([])
  })
})
