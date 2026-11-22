import { describe, expect, it } from 'vitest'
import { parseChangelog } from '../server/utils/changelog'

// Notes de version inventées, au format de semantic-release (conventionalcommits)
const MD = `# Changelog

## [1.2.0](https://example.com/compare/v1.1.0...v1.2.0) (2026-11-20)

### Corrections

* nom de la course corrigé ([abc1234](https://example.com/commit/abc1234def))

### Nouveautés

* **plan:** écran du plan repliable ([def5678](https://example.com/commit/def5678abc))
* écran des réglages (#12)

## [1.1.0](https://example.com/compare/v1.0.0...v1.1.0) (2026-11-18)

### Nouveautés

* thèmes au choix ([0123abc](https://example.com/commit/0123abcdef))
`

describe('parseChangelog', () => {
  const releases = parseChangelog(MD)

  it('deux versions, avec leur date', () => {
    expect(releases.map((r) => [r.version, r.date])).toEqual([
      ['1.2.0', '2026-11-20'],
      ['1.1.0', '2026-11-18'],
    ])
  })

  it('Nouveautés avant Corrections', () => {
    expect(releases[0]!.sections.map((s) => s.title)).toEqual(['Nouveautés', 'Corrections'])
  })

  it('liens de commit et de PR retirés, portée retirée, première lettre en majuscule', () => {
    expect(releases[0]!.sections[0]!.items).toEqual(['Écran du plan repliable', 'Écran des réglages'])
    expect(releases[0]!.sections[1]!.items).toEqual(['Nom de la course corrigé'])
    expect(releases[1]!.sections[0]!.items).toEqual(['Thèmes au choix'])
  })

  it('max respecté', () => {
    expect(parseChangelog(MD, 1).map((r) => r.version)).toEqual(['1.2.0'])
  })
})
