/*
 * Convention de titres « [SOURCE] - Titre de la séance » (ex. « [KIPRUN] - Footing 40’ »,
 * « [FAIL][KIPRUN] - 5x400m(R=200m) », « [RACE] - 10 km des Étangs »), et titre à montrer dans l'appli.
 * Logique pure, testée (tests/titles.test.ts).
 */
import { isGenericName, RUNNER_WORDS } from './naming'

export interface ParsedTitle {
  /** Étiquettes du début, en majuscules : ['FAIL', 'KIPRUN'] */
  tags: string[]
  /** Le titre sans ses étiquettes ni le premier séparateur */
  title: string
  tagged: boolean
}

/*
 * Étiquettes collées au tout début du nom, chacune entre crochets (lettres, chiffres, espaces, « _ . - »),
 * puis un séparateur facultatif (« - », « – », « — » ou « : »). Seul le PREMIER séparateur est retiré :
 * « [RACE] - Trail des Sources - 13 km » garde « Trail des Sources - 13 km ».
 */
const TAGS_RE = /^\s*((?:\[[\p{L}\p{N} _.-]{1,24}\]\s*)+)(?:[-–—:]\s*)?/u

export function parseTitle(name: string | null | undefined): ParsedTitle {
  const n = String(name ?? '')
  const m = n.match(TAGS_RE)
  if (!m) return { tags: [], title: n.trim(), tagged: false }
  const tags = [...m[1]!.matchAll(/\[([^\]]+)\]/g)].map((t) => t[1]!.trim().toUpperCase()).filter(Boolean)
  if (!tags.length) return { tags: [], title: n.trim(), tagged: false }
  return { tags, title: n.slice(m[0].length).trim(), tagged: true }
}

/** Étiquette propre : majuscules, sans crochets ni espaces autour. */
const cleanTag = (t: string) => t.replace(/[[\]]/g, '').trim().toUpperCase()

/**
 * « [FAIL][KIPRUN] - 5x400m(R=200m) ». Sans source : le titre seul (avec « [FAIL] - » devant
 * si la séance est ratée, pour ne pas perdre cette information).
 * Un titre qui porte déjà des étiquettes les perd d'abord (jamais « [KIPRUN] - [KIPRUN] - … »).
 */
export function formatTitle(i: { source?: string | null; title: string; failed?: boolean; failTag?: string }): string {
  const title = parseTitle(i.title).title
  const source = i.source ? cleanTag(i.source) : ''
  const fail = i.failed ? `[${cleanTag(i.failTag || 'FAIL')}]` : ''
  if (!source && !fail) return title
  return `${fail}${source ? `[${source}]` : ''} - ${title}`
}

/** La convention est-elle utilisée ? Oui dès 3 noms étiquetés ; sources de la plus fréquente à la plus rare. */
export function detectConvention(names: string[], failTag = 'FAIL'): { enabled: boolean; sources: string[] } {
  const fail = cleanTag(failTag)
  let tagged = 0
  const count = new Map<string, number>()
  for (const name of names) {
    const p = parseTitle(name)
    if (!p.tagged) continue
    tagged++
    for (const t of p.tags) if (t !== fail) count.set(t, (count.get(t) ?? 0) + 1)
  }
  // Tri stable : à égalité, l'ordre d'apparition est gardé
  const sources = [...count.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t)
  return { enabled: tagged >= 3, sources }
}

/**
 * Titre comparable : minuscules, accents retirés, apostrophes et « × » unifiés, étiquettes
 * et préfixe de montre (« Tapis de course - ») retirés, espaces réduits.
 */
export function normalizeTitle(name: string | null | undefined): string {
  const t = cleanWatchName(parseTitle(name).title).title
  return t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’‘′`´]/g, "'")
    .replace(/[×*]/g, 'x')
    .replace(/\s+/g, ' ')
    .trim()
}

const RACE = 'RACE'
const CUSTOM = 'CUSTOM'

/**
 * Source à proposer pour une course, dans l'ordre :
 * compétition → RACE ; fournisseur Garmin qui contient une source connue (« Kiprun Pacer » → KIPRUN) ;
 * même titre déjà publié avec une source ; dernière source utilisée ; sinon CUSTOM.
 * « history » : titres Strava déjà publiés, du plus récent au plus ancien. RACE n'y est jamais repris
 * (une étiquette de compétition ne doit pas déborder sur un entraînement).
 */
export function guessSource(i: {
  provider?: string | null
  title: string
  isRace?: boolean
  known: string[]
  history: { title: string; source: string }[]
}): string {
  if (i.isRace) return RACE
  const provider = (i.provider ?? '').toLowerCase()
  if (provider) {
    const hit = i.known.find((k) => k && k !== RACE && k !== CUSTOM && provider.includes(k.toLowerCase()))
    if (hit) return cleanTag(hit)
  }
  const usable = i.history.filter((h) => h.source && cleanTag(h.source) !== RACE)
  const key = normalizeTitle(i.title)
  const same = key ? usable.find((h) => normalizeTitle(h.title) === key) : undefined
  if (same) return cleanTag(same.source)
  if (usable[0]) return cleanTag(usable[0].source)
  return CUSTOM
}

/*
 * Une montre Garmin nomme une séance lancée depuis un entraînement « Lieu - Nom de la séance »
 * ou « Tapis de course - Nom de la séance ». La partie gauche est retirée seulement si c'est un nom
 * par défaut, ou un lieu : 1 à 4 mots sans chiffre, le premier avec une majuscule, qui ne commence pas
 * par un mot de coureur (« Sortie longue - 3 km vite » reste entier).
 */
const PLACE_RE = /^\p{Lu}[\p{L}'’.-]*(?: [\p{L}'’.-]+){0,3}$/u

export function cleanWatchName(name: string | null | undefined): { prefix: string | null; title: string } {
  const n = String(name ?? '').trim()
  const m = n.match(/^(.+?)\s+[-–—]\s+(.+)$/)
  if (!m) return { prefix: null, title: n }
  const left = m[1]!.trim()
  const right = m[2]!.trim()
  const place = PLACE_RE.test(left) && !RUNNER_WORDS.has(left.split(' ')[0]!)
  if (isGenericName(left) || place) return { prefix: left, title: right }
  return { prefix: null, title: n }
}

/**
 * Titre à montrer dans l'appli : le titre Strava sans ses étiquettes s'il n'est pas générique ;
 * sinon le nom de la montre nettoyé s'il n'est pas générique ; sinon le nom Strava tel quel.
 */
export function displayTitle(a: { stravaName?: string | null; garminName?: string | null }): { title: string; tags: string[] } {
  const strava = parseTitle(a.stravaName)
  if (strava.title && !isGenericName(strava.title)) return { title: strava.title, tags: strava.tags }
  const watch = cleanWatchName(a.garminName).title
  if (watch && !isGenericName(watch)) return { title: watch, tags: strava.tags }
  return { title: String(a.stravaName ?? '').trim() || watch || 'Course', tags: strava.tags }
}
