/*
 * Nommage des courses : modèles par type de séance, noms par défaut reconnus,
 * et choix du nom appliqué automatiquement. Logique pure, testée (tests/naming.test.ts).
 */
import { formatDay, formatDuration, formatKm, formatPace } from './format'
import { RUN_LABELS, type RunType } from './runs'

export const NAMING_TOKENS = [
  { key: 'type', label: 'Type' },
  { key: 'distance', label: 'Distance' },
  { key: 'durée', label: 'Durée' },
  { key: 'allure', label: 'Allure' },
  { key: 'lieu', label: 'Lieu' },
  { key: 'jour', label: 'Jour' },
  { key: 'moment', label: 'Moment' },
  { key: 'météo', label: 'Météo' },
] as const

export const DEFAULT_TEMPLATES: Record<RunType, string> = {
  long: 'Sortie longue {distance} km · {lieu}',
  interval: 'Fractionné {lieu} · {allure} /km',
  easy: 'Footing {distance} km · {lieu}',
  recovery: 'Footing récup {distance} km',
  tempo: 'Tempo {distance} km à {allure} /km',
}

/*
 * Noms par défaut des montres et de Strava, qu'une règle peut remplacer.
 * Un faux positif est plus grave qu'un oubli (on remplacerait un titre écrit à la main) :
 * on compare toujours le nom ENTIER, jamais « contient ».
 */
const DAYS = 'lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche'
const GENERIC: RegExp[] = [
  // Strava en anglais : « Morning Run », « Afternoon Virtual Run », « Morning Trail Run »…
  /^(morning|lunch|afternoon|evening|night)( trail| virtual)? run$/i,
  // Strava en français : « Course à pied le matin », « Running dans l'après-midi du samedi »…
  new RegExp(`^(course à pied|course|trail|running) (le matin|le midi|à l'heure du déjeuner|dans l'après-midi|en soirée|de nuit)( du (${DAYS}))?$`, 'i'),
  // Anciennes formes : « Course du matin », « Footing du soir », « Course midi »…
  /^(course|footing) (du )?(matin|midi|soir|après-midi)$/i,
  // Nom du sport seul (montres, tapis, applis)
  /^(course|course à pied|run|running|trail|trail run|trail running|virtual run|tapis de course|treadmill running|course à pied sur tapis roulant|course à pied virtuelle|indoor running|track running)$/i,
]

/*
 * Défaut Garmin « Lieu + type » : « Bruxelles Course à pied », « Brussels Running », « Braine-l'Alleud Trail Running ».
 * Le type garde exactement cette casse ; le lieu fait 1 à 4 mots sans chiffre, le premier avec une majuscule,
 * et ne commence pas par un mot de coureur (« Easy Running », « Sortie course à pied » restent des titres écrits).
 */
const PLACE_TYPE = /^(\p{Lu}[^\s\d]*(?: [^\s\d]+){0,3}) (Course à pied|Running|Trail Running)$/u
export const RUNNER_WORDS = new Set([
  'Easy', 'Long', 'Slow', 'Fast', 'Hard', 'Tempo', 'Recovery', 'Steady', 'Interval', 'Intervals', 'Hill', 'Hills', 'Trail', 'Track',
  'Morning', 'Lunch', 'Afternoon', 'Evening', 'Night', 'Sortie', 'Footing', 'Séance', 'Petite', 'Grande', 'Belle', 'Bonne',
  'Première', 'Dernière', 'Ma', 'Mon', 'Notre',
])

/** Espaces de début/fin retirés, espaces multiples réduits, apostrophe typographique « ’ » = « ' ». */
const normalizeName = (name: string) => name.replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim()

export function isGenericName(name: string) {
  const n = normalizeName(name ?? '')
  if (!n) return true
  if (GENERIC.some((re) => re.test(n))) return true
  const m = n.match(PLACE_TYPE)
  return Boolean(m && !RUNNER_WORDS.has(m[1]!.split(' ')[0]!))
}

/** Ce dont un modèle a besoin : une activité de l'appli convient telle quelle. */
export interface NamingInput {
  type: RunType
  distanceKm: number
  durationSec: number
  place: string
  startedAt: string
  weather?: { tempC: number; sky: string }
}

const hourFmt = new Intl.DateTimeFormat('fr-BE', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Europe/Brussels' })

function moment(iso: string) {
  // fr-BE écrit « 11 h » : on lit seulement la partie « heure », sinon Number() donne NaN (et toujours « soir »)
  const h = Number(hourFmt.formatToParts(new Date(iso)).find((p) => p.type === 'hour')?.value)
  if (h < 11) return 'matin'
  if (h < 14) return 'midi'
  if (h < 18) return 'après-midi'
  return 'soir'
}

export function renderTemplate(a: NamingInput, template: string) {
  const values: Record<string, string> = {
    type: RUN_LABELS[a.type],
    distance: formatKm(a.distanceKm),
    durée: formatDuration(a.durationSec),
    allure: formatPace(a.durationSec, a.distanceKm),
    lieu: a.place ? a.place.charAt(0).toUpperCase() + a.place.slice(1) : '',
    jour: formatDay(a.startedAt).split(' ')[0]!,
    moment: moment(a.startedAt),
    météo: a.weather ? `${a.weather.tempC} °C, ${a.weather.sky}` : '',
  }
  return template
    .replace(/\{([^}]+)\}/g, (m, k: string) => values[k.toLowerCase()] ?? m)
    .replace(/\s+/g, ' ')
    .replace(/\s*·\s*$/, '')
    .replace(/^\s*·\s*/, '')
    .trim()
}

export interface AutoNameInput {
  stravaName: string
  garminName: string
  /** Une activité Garmin est reliée à la course */
  hasGarmin: boolean
  /** Titre donné par la règle de nommage ; '' quand les règles sont désactivées */
  ruleTitle: string
  /** Option « Écraser un nom Strava, même modifié à la main » */
  overwriteEdited: boolean
}

/**
 * Nom à appliquer automatiquement sur Strava, ou null s'il n'y a rien à faire :
 * - le nom Garmin parlant gagne si le nom Strava est générique, ou si l'option « Écraser » est active ;
 * - sinon, une règle ne remplace qu'un nom Strava générique, jamais un nom écrit à la main.
 */
export function decideAutoName(i: AutoNameInput): { target: string; source: 'garmin' | 'regle' } | null {
  const stravaGeneric = isGenericName(i.stravaName)
  const garminIsGood = i.hasGarmin && !isGenericName(i.garminName)
  let target = ''
  let source: 'garmin' | 'regle' = 'garmin'
  if (garminIsGood && i.garminName !== i.stravaName && (stravaGeneric || i.overwriteEdited)) target = i.garminName
  else if (stravaGeneric && i.ruleTitle) {
    target = i.ruleTitle
    source = 'regle'
  }
  return target && target !== i.stravaName ? { target, source } : null
}
