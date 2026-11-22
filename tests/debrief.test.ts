import { describe, expect, it } from 'vitest'
import { mergeDebrief, needsDebrief } from '../shared/utils/debrief'

const SINCE = '2026-11-18T12:00:00.000Z'
const run = (o: Partial<{ id: string; startedAt: string; stravaName: string }> = {}) => ({
  id: 'r1',
  startedAt: '2026-11-19T17:40:00Z',
  stravaName: 'Course à pied en soirée',
  ...o,
})

describe('needsDebrief', () => {
  it('course récente sans débrief : à débriefer', () => {
    expect(needsDebrief(run(), {}, { since: SINCE, convention: true })).toBe(true)
  })
  it('débrief fait ou passé : non ; brouillon : oui', () => {
    const at = SINCE
    expect(needsDebrief(run(), { r1: mergeDebrief(null, { status: 'done' }, at) }, { since: SINCE, convention: false })).toBe(false)
    expect(needsDebrief(run(), { r1: mergeDebrief(null, { status: 'skipped' }, at) }, { since: SINCE, convention: false })).toBe(false)
    expect(needsDebrief(run(), { r1: mergeDebrief(null, { note: 'x' }, at) }, { since: SINCE, convention: false })).toBe(true)
  })
  it('avant « since », ou sans « since » : rien n’est réclamé', () => {
    expect(needsDebrief(run({ startedAt: '2026-11-17T08:00:00Z' }), {}, { since: SINCE, convention: false })).toBe(false)
    expect(needsDebrief(run(), {}, { since: '', convention: false })).toBe(false)
  })
  it('titre déjà étiqueté : traité, seulement quand la convention est active', () => {
    const tagged = run({ stravaName: '[KIPRUN] - Footing 45’' })
    expect(needsDebrief(tagged, {}, { since: SINCE, convention: true })).toBe(false)
    expect(needsDebrief(tagged, {}, { since: SINCE, convention: false })).toBe(true)
  })
})

describe('mergeDebrief', () => {
  it('fusionne et date la modification', () => {
    const a = mergeDebrief(null, { rpe: 6 }, '2026-11-19T18:00:00Z')
    expect(a).toEqual({ status: 'draft', outcome: null, rpe: 6, note: '', source: null, planId: null, title: null, block: null, at: '2026-11-19T18:00:00Z' })
    const b = mergeDebrief(a, { status: 'done', note: 'Bien' }, '2026-11-19T18:05:00Z')
    expect(b).toMatchObject({ status: 'done', rpe: 6, note: 'Bien', at: '2026-11-19T18:05:00Z' })
  })
})
