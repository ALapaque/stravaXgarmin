import { describe, expect, it } from 'vitest'
import type { StepResult } from '../shared/utils/compliance'
import { composeBlock, DEFAULT_PARTS, describeContext, effortTimes, mergeDebrief, needsDebrief, OUTCOME_LABELS, partsOf, planVsDone, RPE_LABELS, seedTitle, stepLines } from '../shared/utils/debrief'

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

describe('composeBlock', () => {
  const ALL = { ...DEFAULT_PARTS }
  const base = {
    note: 'Ma note libre, telle que je l’ai écrite.',
    rpe: 7,
    outcome: 'short' as const,
    resultSummary: '5 efforts sur 8',
    analysis: { verdict: 'Le verdict de l’analyse en une phrase.', findings: [{ title: 'Régularité', text: 'Efforts très proches.' }, { title: 'Fin', text: 'Coupé au 6ᵉ.' }] },
    efforts: [141, 136, 139, 144, 150],
    splits: [372, 360],
    shoe: { name: 'Modèle fictif', km: 140.4 },
    parts: ALL,
  }

  it('tout activé : l’ordre et la forme du document', () => {
    expect(composeBlock(base)).toBe(
      [
        'Ma note libre, telle que je l’ai écrite.',
        '',
        'Ressenti : 7/10 · Séance écourtée (5 efforts sur 8)',
        'Le verdict de l’analyse en une phrase.',
        'Régularité : Efforts très proches.',
        'Fin : Coupé au 6ᵉ.',
        'Efforts : 2:21 · 2:16 · 2:19 · 2:24 · 2:30',
        'Chaussures : Modèle fictif (140 km)',
        '— via stravaXgarmin',
      ].join('\n'),
    )
  })

  it('chaque partie se coupe seule', () => {
    const off = (k: keyof typeof ALL) => composeBlock({ ...base, parts: { ...ALL, [k]: false } })
    expect(off('note')).not.toContain('Ma note')
    expect(off('note').startsWith('Ressenti')).toBe(true)
    expect(off('feeling')).not.toContain('Ressenti')
    expect(off('feeling')).not.toContain('Séance écourtée')
    expect(off('analysis')).not.toContain('verdict')
    expect(off('numbers')).not.toContain('Efforts : ')
    expect(off('shoes')).not.toContain('Chaussures')
    expect(off('signature')).not.toContain('via stravaXgarmin')
  })

  it('note seule (avec ou sans signature), rien du tout', () => {
    const none = { note: false, feeling: false, analysis: false, numbers: false, shoes: false, signature: false }
    expect(composeBlock({ ...base, parts: { ...none, note: true } })).toBe('Ma note libre, telle que je l’ai écrite.')
    expect(composeBlock({ ...base, parts: { ...none, note: true, signature: true } })).toBe('Ma note libre, telle que je l’ai écrite.\n\n— via stravaXgarmin')
    expect(composeBlock({ ...base, parts: { ...none, signature: true } })).toBe('')
    expect(composeBlock({ ...base, note: '  ', rpe: null, outcome: null, analysis: null, efforts: null, splits: [], shoe: null })).toBe('')
  })

  it('efforts pour une séance à répétitions, sinon le temps au km ; jamais les deux', () => {
    const km = composeBlock({ ...base, efforts: null })
    expect(km).toContain('Km : 6:12 · 6:00')
    expect(km).not.toContain('Efforts : ')
    expect(composeBlock({ ...base, efforts: [141] })).toContain('Km : ')
    expect(composeBlock({ ...base })).not.toContain('Km : ')
  })

  it('issues, ressenti seul, issue seule, sans résumé', () => {
    expect(composeBlock({ ...base, outcome: 'done', resultSummary: null })).toContain('Ressenti : 7/10 · Séance faite\n')
    expect(composeBlock({ ...base, outcome: 'failed' })).toContain('Séance ratée (5 efforts sur 8)')
    expect(composeBlock({ ...base, outcome: null })).toContain('Ressenti : 7/10\n')
    expect(composeBlock({ ...base, rpe: null })).toContain('\nSéance écourtée (5 efforts sur 8)\n')
    expect(composeBlock({ ...base, rpe: 12 as number })).not.toContain('/10')
  })

  it('aucun espace en fin de ligne, pas de ligne vide en trop', () => {
    const t = composeBlock({ ...base, note: 'Ligne 1   \n\n\n\nLigne 2  \n', analysis: { verdict: ' Un  verdict \n', findings: [{ title: 'A ', text: ' b ' }] } })
    for (const line of t.split('\n')) expect(line).toBe(line.trimEnd())
    expect(t).not.toMatch(/\n\n\n/)
    expect(t.startsWith('Ligne 1\n\nLigne 2\n\nRessenti')).toBe(true)
    expect(t).toContain('\nUn verdict\nA : b\n')
  })
})

describe('libellés', () => {
  it('dix mots de ressenti et trois issues', () => {
    expect(Object.keys(RPE_LABELS)).toHaveLength(10)
    expect(RPE_LABELS[7]).toBe('Difficile')
    expect(OUTCOME_LABELS).toEqual({ done: 'Faite', short: 'Écourtée', failed: 'Ratée' })
  })
  it('réglages gardés par une version précédente : anciennes clés ignorées, choix gardés', () => {
    expect(partsOf({ enabled: false, weather: true, splits: false, shoes: false, signature: true })).toEqual({ ...DEFAULT_PARTS, shoes: false })
    expect(partsOf(null)).toEqual(DEFAULT_PARTS)
  })
})

describe('étapes, efforts et contexte de l’analyse', () => {
  const step = (o: Partial<StepResult>): StepResult => ({ kind: 'interval', planned: { sec: null, m: 400 }, done: true, fraction: 1, actual: { sec: 141, m: 400, hr: 163 }, exact: true, ...o })
  const steps = [
    step({ kind: 'warmup', planned: { sec: 900, m: null }, actual: { sec: 901, m: 2150, hr: 128 } }),
    step({}),
    step({ exact: false }),
    step({ done: false, fraction: 0.4, actual: { sec: 50, m: 160, hr: 165 } }),
    step({ done: false, fraction: 0, actual: null }),
  ]

  it('lignes lisibles ; pas de chiffres pour une étape estimée', () => {
    expect(stepLines(steps)).toEqual([
      'Échauffement 15 min : 15:01 à 6:59 /km, 128 bpm',
      'Effort 400 m : 2:21 à 5:53 /km, 163 bpm',
      'Effort 400 m : fait',
      'Effort 400 m : arrêté en cours (40 %)',
      'Effort 400 m : non fait',
    ])
    expect(stepLines(null)).toEqual([])
  })

  it('efforts mesurés par la montre, séance comptée en efforts seulement', () => {
    expect(effortTimes({ basis: 'reps', steps: [...steps, step({ actual: { sec: 136, m: 400, hr: 165 } })] })).toEqual([141, 136])
    expect(effortTimes({ basis: 'duration', steps })).toBeNull()
    expect(effortTimes({ basis: 'reps', steps })).toBeNull()
    expect(effortTimes(null)).toBeNull()
  })

  it('contexte : tapis, séance, réalisé, étapes, ressenti ; la note seulement si elle est là', () => {
    const lines = describeContext({
      indoor: true,
      plan: { title: '8x400m (R=1’)', summary: '15 min + 8 × 400 m, récup 1 min + 10 min', outcome: 'short', result: '5 efforts sur 8', steps: ['Effort 400 m : fait'] },
      feeling: { rpe: 7 },
    })
    expect(lines).toEqual([
      'Séance sur tapis (pas de GPS : distance mesurée par la montre)',
      'Séance prévue : 8x400m (R=1’) — 15 min + 8 × 400 m, récup 1 min + 10 min',
      'Réalisé : Séance écourtée, 5 efforts sur 8',
      'Détail des étapes :\n- Effort 400 m : fait',
      'Ressenti du coureur : 7/10',
    ])
    expect(describeContext({ feeling: { rpe: null, note: 'x'.repeat(900) } })).toEqual([`Note du coureur : ${'x'.repeat(500)}`])
    expect(describeContext({ indoor: 'oui', plan: 'n’importe quoi', feeling: 3 })).toEqual([])
  })
})

describe('seedTitle', () => {
  it('Strava soigné, puis séance prévue, puis montre, puis règle', () => {
    expect(seedTitle({ stravaName: '[KIPRUN] - Fractionné du mardi', planTitle: '8x400m' })).toBe('Fractionné du mardi')
    expect(seedTitle({ stravaName: 'Course à pied en soirée', planTitle: '8x400m (R=1’)' })).toBe('8x400m (R=1’)')
    expect(seedTitle({ stravaName: 'Morning Run', garminName: 'Tapis de course - Côtes', ruleTitle: 'Footing' })).toBe('Côtes')
    expect(seedTitle({ stravaName: 'Morning Run', garminName: 'Course à pied', ruleTitle: 'Footing 8 km' })).toBe('Footing 8 km')
  })
})

describe('planVsDone', () => {
  const s = (o: Partial<StepResult>): StepResult => ({ kind: 'interval', planned: { sec: null, m: 400 }, done: true, fraction: 1, actual: { sec: 120, m: 400, hr: 160 }, exact: true, ...o })
  it('étapes faites à leur durée réelle, la part non faite en fantôme, axe commun', () => {
    const r = planVsDone([
      s({ kind: 'warmup', planned: { sec: 600, m: null }, actual: { sec: 600, m: 1500, hr: 120 } }),
      s({}),
      s({ done: false, fraction: 0.5, actual: { sec: 60, m: 200, hr: 165 } }),
      s({ done: false, fraction: 0, actual: null }),
    ])
    expect(r.planned.map((b) => Math.round(b.sec))).toEqual([600, 121, 121, 121])
    expect(r.done.map((b) => [b.state, Math.round(b.sec)])).toEqual([['done', 600], ['done', 120], ['partial', 60], ['missed', 61], ['missed', 121]])
    expect(Math.round(r.total)).toBe(964)
    // Le plus rapide tout en haut, le plus lent en bas
    expect(r.done[1]!.level).toBeCloseTo(1)
    expect(r.done[0]!.level).toBeCloseTo(0.22)
  })
  it('rien : profils vides', () => {
    expect(planVsDone(null)).toEqual({ planned: [], done: [], total: 1 })
  })
})
