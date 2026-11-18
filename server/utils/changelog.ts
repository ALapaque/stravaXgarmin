/*
 * Lecture du CHANGELOG.md généré par semantic-release (format conventionalcommits).
 * Le fichier est lu au build (voir nuxt.config.ts) et servi par /api/changelog :
 * une appli encore ouverte peut donc lire les notes de la version qui vient d'être déployée.
 */
export interface Release {
  version: string
  date: string
  sections: { title: string; items: string[] }[]
}

export function parseChangelog(md: string, max = 12): Release[] {
  const releases: Release[] = []
  let current: Release | undefined
  let section: Release['sections'][number] | undefined

  for (const raw of md.split('\n')) {
    const line = raw.trim()
    const head = line.match(/^#{1,2}\s+\[?(\d+\.\d+\.\d+[^\]\s]*)\]?.*?\((\d{4}-\d{2}-\d{2})\)/)
    if (head) {
      if (releases.length >= max) break
      current = { version: head[1]!, date: head[2]!, sections: [] }
      releases.push(current)
      section = undefined
      continue
    }
    const sec = line.match(/^###\s+(.+)/)
    if (sec && current) {
      section = { title: sec[1]!.trim(), items: [] }
      current.sections.push(section)
      continue
    }
    const item = line.match(/^[*-]\s+(.+)/)
    if (item && section) {
      const text = item[1]!
        .replace(/\(\[[0-9a-f]{7,}\]\([^)]*\)\)/gi, '') // lien vers le commit
        .replace(/\(#\d+\)|\(\[#\d+\]\([^)]*\)\)/g, '') // lien vers une PR
        .replace(/\*\*([^*]+):\*\*\s*/, '') // portée « **scope:** »
        .trim()
      if (text) section.items.push(text.charAt(0).toUpperCase() + text.slice(1))
    }
  }
  // Nouveautés d'abord, puis corrections, performances, le reste
  const ORDER = ['Nouveautés', 'Corrections', 'Performances']
  const rank = (t: string) => (ORDER.includes(t) ? ORDER.indexOf(t) : ORDER.length)
  for (const r of releases) r.sections.sort((a, b) => rank(a.title) - rank(b.title))
  return releases
}
