import type { Activity } from './useActivities'

export interface DescriptionOptions {
  weather: boolean
  splits: boolean
  shoes: boolean
  signature: boolean
}

function shortPace(sec: number) {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
}

/** Texte ajouté à la description Strava. */
export function buildDescription(a: Activity, o: DescriptionOptions) {
  const lines: string[] = []
  if (o.weather && a.weather) lines.push(`Météo : ${a.weather.tempC} °C, ${a.weather.sky}, vent ${a.weather.windKmh} km/h`)
  if (o.splits && a.splits.length) lines.push(`Km : ${a.splits.map(shortPace).join(' · ')}`)
  if (o.shoes && a.shoe) lines.push(`Chaussures : ${a.shoe.name} (${a.shoe.km} km)`)
  if (o.signature && lines.length) lines.push('— via stravaXgarmin')
  return lines.join('\n')
}

export function useDescription() {
  const settings = useSettings()
  const describe = (a: Activity) => buildDescription(a, settings.value.description)
  return { describe }
}
