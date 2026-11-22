import { describe, expect, it } from 'vitest'
import { buildDescription, hasBlock, mergeDescription, MAX_DESCRIPTION, normalizeNewlines } from '../shared/utils/description'

// Notes et blocs inventés
const NOTE = 'Séance costaud sous la pluie. Les deux derniers 400 étaient de trop, à refaire plus frais.'
const BLOCK = 'Météo : 9 °C, pluie fine, vent 20 km/h\nKm : 5:12 · 5:30\n— via stravaXgarmin'
const BLOCK2 = 'Météo : 9 °C, pluie fine, vent 20 km/h\nKm : 5:12 · 5:30\nChaussures : Modèle X (190 km)\n— via stravaXgarmin'

describe('buildDescription', () => {
  const run = { weather: { tempC: 9, sky: 'pluie fine', windKmh: 20 }, splits: [312, 330], shoe: { name: 'Modèle X', km: 190 } }
  it('toutes les parties', () => {
    expect(buildDescription(run, { weather: true, splits: true, shoes: true, signature: true })).toBe(BLOCK2)
  })
  it('rien de coché : pas de signature seule', () => {
    expect(buildDescription(run, { weather: false, splits: false, shoes: false, signature: true })).toBe('')
  })
})

describe('mergeDescription', () => {
  it('description vide : le bloc seul', () => {
    expect(mergeDescription('', BLOCK)).toEqual({ text: BLOCK, change: 'added', block: BLOCK })
    expect(mergeDescription(null, BLOCK).text).toBe(BLOCK)
    expect(mergeDescription('  \n ', BLOCK).text).toBe(BLOCK)
  })

  it('le bloc se place sous la note, séparé par une ligne vide', () => {
    expect(mergeDescription(`${NOTE}\n\n  `, `  ${BLOCK}\n`)).toEqual({ text: `${NOTE}\n\n${BLOCK}`, change: 'added', block: BLOCK })
  })

  it('(a) un ajout commence toujours par le texte de l’utilisateur', () => {
    for (const current of [NOTE, `${NOTE}\n`, `  ${NOTE}  `, 'Ligne 1\n\nLigne 2\n\n\n', '😀 émoji', 'x'.repeat(4000)]) {
      const r = mergeDescription(current, BLOCK)
      expect(r.change).toBe('added')
      expect(r.text.startsWith(current.trimEnd())).toBe(true)
    }
  })

  it('(b) ajouter puis retirer le même bloc rend exactement la note', () => {
    for (const current of [NOTE, `${NOTE}\n\n`, '', 'Ligne 1\n\nLigne 2']) {
      const added = mergeDescription(current, BLOCK)
      const removed = mergeDescription(added.text, '', added.block)
      expect(removed.change).toBe('removed')
      expect(removed.text).toBe(current.trimEnd())
    }
  })

  it('(c) ajouter deux fois = ajouter une fois', () => {
    const once = mergeDescription(NOTE, BLOCK)
    expect(mergeDescription(once.text, BLOCK)).toEqual({ text: once.text, change: 'none', block: '' })
    // Même avec le souvenir du bloc publié
    expect(mergeDescription(once.text, BLOCK, BLOCK).change).toBe('none')
  })

  it('(d) remplacer un ancien bloc placé au milieu garde le texte avant et après', () => {
    const current = `${NOTE}\n\n${BLOCK}\n\nAjouté plus tard sur Strava.`
    expect(mergeDescription(current, BLOCK2, BLOCK)).toEqual({
      text: `${NOTE}\n\n${BLOCK2}\n\nAjouté plus tard sur Strava.`,
      change: 'replaced',
      block: BLOCK2,
    })
  })

  it('retirer un bloc placé au milieu', () => {
    const current = `${NOTE}\n\n${BLOCK}\n\nAjouté plus tard sur Strava.`
    expect(mergeDescription(current, '', BLOCK).text).toBe(`${NOTE}\n\nAjouté plus tard sur Strava.`)
    // Bloc en tête de description
    expect(mergeDescription(`${BLOCK}\n\n${NOTE}`, '', BLOCK).text).toBe(NOTE)
  })

  it('le dernier exemplaire du bloc est celui qui est remplacé', () => {
    const current = `${BLOCK}\n\nNote\n\n${BLOCK}`
    expect(mergeDescription(current, BLOCK2, BLOCK).text).toBe(`${BLOCK}\n\nNote\n\n${BLOCK2}`)
  })

  it('(e) bloc retouché à la main sur Strava + retrait demandé : rien ne bouge', () => {
    const current = `${NOTE}\n\n${BLOCK.replace('pluie fine', 'grosse averse')}`
    expect(mergeDescription(current, '', BLOCK)).toEqual({ text: current, change: 'none', block: '' })
  })

  it('bloc retouché sur Strava + nouveau bloc : ajouté à la suite, rien n’est effacé', () => {
    const edited = `${NOTE}\n\n${BLOCK.replace('pluie fine', 'grosse averse')}`
    const r = mergeDescription(edited, BLOCK2, BLOCK)
    expect(r.change).toBe('added')
    expect(r.text).toBe(`${edited}\n\n${BLOCK2}`)
  })

  it('bloc identique au précédent : rien à faire', () => {
    const current = `${NOTE}\n\n${BLOCK}`
    expect(mergeDescription(current, BLOCK, BLOCK).change).toBe('none')
  })

  it('bloc vide sans précédent : rien à faire', () => {
    expect(mergeDescription(NOTE, '')).toEqual({ text: NOTE, change: 'none', block: '' })
    expect(mergeDescription(NOTE, '   ', 'introuvable').change).toBe('none')
  })

  it('(f) fins de ligne « \\r\\n » (renvoyées par Strava) : bloc retrouvé, remplacé, retiré', () => {
    const crlf = `${NOTE}\r\n\r\n${BLOCK.replace(/\n/g, '\r\n')}`
    expect(hasBlock(crlf, BLOCK)).toBe(true)
    // Retrouvé : pas d'ajout en double
    expect(mergeDescription(crlf, BLOCK).change).toBe('none')
    expect(mergeDescription(crlf, BLOCK, BLOCK).change).toBe('none')
    // Remplacé
    const replaced = mergeDescription(crlf, BLOCK2, BLOCK)
    expect(replaced).toEqual({ text: `${NOTE}\n\n${BLOCK2}`, change: 'replaced', block: BLOCK2 })
    expect(replaced.text).not.toContain('\r')
    // Retiré
    expect(mergeDescription(crlf, '', BLOCK)).toEqual({ text: NOTE, change: 'removed', block: '' })
    // Bloc mémorisé en « \r\n » lui aussi
    expect(mergeDescription(crlf, '', BLOCK.replace(/\n/g, '\r\n')).change).toBe('removed')
  })

  it('(g) trop long : le bloc est raccourci, jamais la note', () => {
    const current = 'n'.repeat(MAX_DESCRIPTION - 100)
    const r = mergeDescription(current, 'b'.repeat(500))
    expect(r.change).toBe('added')
    expect(r.text.length).toBeLessThanOrEqual(MAX_DESCRIPTION)
    expect(r.text.startsWith(`${current}\n\n`)).toBe(true)
    expect(r.text.endsWith('…')).toBe(true)
    expect(r.block).toBe(r.text.slice(current.length + 2))
  })

  it('(g) plus assez de place : rien n’est ajouté (full)', () => {
    const current = 'n'.repeat(MAX_DESCRIPTION - 30)
    expect(mergeDescription(current, BLOCK)).toEqual({ text: current, change: 'full', block: '' })
    // Remplacement qui ne tient plus : rien ne change non plus
    const max = 180
    const withBlock = `${'n'.repeat(150)}\n\n${BLOCK.slice(0, 20)}`
    expect(mergeDescription(withBlock, 'z'.repeat(300), BLOCK.slice(0, 20), max).change).toBe('full')
  })

  it('normalizeNewlines', () => {
    expect(normalizeNewlines('a\r\nb\rc\nd')).toBe('a\nb\nc\nd')
    expect(normalizeNewlines(null)).toBe('')
  })
})
