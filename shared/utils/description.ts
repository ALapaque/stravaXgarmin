/*
 * Texte que l'appli propose d'ajouter à la description Strava.
 * Logique pure, testée (tests/description.test.ts).
 */

export interface DescriptionOptions {
  weather: boolean
  splits: boolean
  shoes: boolean
  signature: boolean
}

/** Ce dont le texte a besoin : une activité de l'appli convient telle quelle. */
export interface DescriptionInput {
  weather?: { tempC: number; sky: string; windKmh: number }
  splits: number[]
  shoe?: { name: string; km: number }
}

function shortPace(sec: number) {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
}

/** Texte ajouté à la description Strava. */
export function buildDescription(a: DescriptionInput, o: DescriptionOptions) {
  const lines: string[] = []
  if (o.weather && a.weather) lines.push(`Météo : ${a.weather.tempC} °C, ${a.weather.sky}, vent ${a.weather.windKmh} km/h`)
  if (o.splits && a.splits.length) lines.push(`Km : ${a.splits.map(shortPace).join(' · ')}`)
  if (o.shoes && a.shoe) lines.push(`Chaussures : ${a.shoe.name} (${a.shoe.km} km)`)
  if (o.signature && lines.length) lines.push('— via stravaXgarmin')
  return lines.join('\n')
}
