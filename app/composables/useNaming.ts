import type { Activity, RunType } from './useActivities'

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
  recovery: 'Footing récup {distance} km',
  tempo: 'Tempo {distance} km à {allure} /km',
}

/** Noms par défaut des montres et de Strava, qu'une règle peut remplacer. */
const GENERIC = /^(morning|afternoon|evening|night|lunch) run$|^course( à pied)?$|^(course|footing) (du )?(matin|midi|soir|après-midi)$|course à pied$/i

export function isGenericName(name: string) {
  return GENERIC.test(name.trim())
}

function moment(iso: string) {
  const h = Number(new Intl.DateTimeFormat('fr-BE', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Europe/Brussels' }).format(new Date(iso)))
  if (h < 11) return 'matin'
  if (h < 14) return 'midi'
  if (h < 18) return 'après-midi'
  return 'soir'
}

export function renderTemplate(a: Activity, template: string) {
  const values: Record<string, string> = {
    type: RUN_TYPES[a.type].label,
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

export function useNaming() {
  const settings = useSettings()
  const ruleTitle = (a: Activity) => renderTemplate(a, settings.value.naming.templates[a.type])
  return { ruleTitle }
}
