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

/** Noms par défaut des montres et de Strava, qu'une règle peut remplacer. */
const GENERIC = /^(morning|afternoon|evening|night|lunch) run$|^course( à pied)?$|^(course|footing) (du )?(matin|midi|soir|après-midi)$|course à pied$/i

export function isGenericName(name: string) {
  return GENERIC.test(name.trim())
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

function moment(iso: string) {
  const h = Number(new Intl.DateTimeFormat('fr-BE', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Europe/Brussels' }).format(new Date(iso)))
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
