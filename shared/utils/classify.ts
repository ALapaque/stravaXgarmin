/*
 * Type de séance d'une course Strava, et lien avec l'activité Garmin correspondante.
 * Logique pure, testée (tests/classify.test.ts).
 */
import type { RunType } from './runs'

/** Champs utiles d'une course Strava (GET /athlete/activities). */
export interface StravaRun {
  id: number
  name: string
  start_date: string
  distance: number
  moving_time: number
  total_elevation_gain: number
  average_heartrate?: number
  workout_type?: number | null
  location_city?: string | null
  map?: { summary_polyline?: string | null }
  gear_id?: string | null
}

/** Champs utiles d'une activité Garmin (liste des activités). */
export interface GarminRun {
  id: number
  name: string
  startTimeGMT: string
  distance?: number
  effect?: string | null
}

/** Repères personnels : allure (s/km) et distance (km) habituelles sur les courses chargées. */
export interface Habits {
  pace: number
  km: number
}

const median = (v: number[]) => {
  const s = [...v].sort((x, y) => x - y)
  return s.length ? s[Math.floor(s.length / 2)]! : 0
}

export function habitsOf(runs: StravaRun[]): Habits {
  const ok = runs.filter((r) => r.distance >= 2000 && r.moving_time > 0)
  if (ok.length < 4) return { pace: 330, km: 8 }
  return {
    pace: median(ok.map((r) => r.moving_time / (r.distance / 1000))),
    km: median(ok.map((r) => r.distance / 1000)),
  }
}

/*
 * Type de séance, du signal le plus sûr au plus approximatif :
 * 1. ce que tu as indiqué (type « Sortie longue » ou « Entraînement » sur Strava, mots du nom) ;
 * 2. l'effet principal calculé par ta montre Garmin (sur ta fréquence cardiaque et ton profil) ;
 * 3. sinon ton allure et ta distance comparées à tes habitudes des 60 derniers jours.
 */
export function classify(s: StravaRun, g: GarminRun | undefined, h: Habits): { type: RunType; reason: string } {
  const km = s.distance / 1000
  const pace = s.moving_time / Math.max(km, 0.1)
  const long = km >= Math.max(12, h.km * 1.6) || km >= 18

  if (s.workout_type === 2) return { type: 'long', reason: 'marquée sortie longue sur Strava' }
  if (/fraction|interval|vma|piste|\d+\s*[x×]\s*\d+/i.test(s.name)) return { type: 'interval', reason: 'd’après son nom' }
  if (/tempo|seuil|threshold/i.test(s.name)) return { type: 'tempo', reason: 'd’après son nom' }
  if (/r[ée]cup|recovery/i.test(s.name)) return { type: 'recovery', reason: 'd’après son nom' }
  if (/sortie longue|long run/i.test(s.name)) return { type: 'long', reason: 'd’après son nom' }

  const effect = (g?.effect ?? '').toUpperCase()
  if (effect) {
    const watch = 'selon ta montre'
    if (/RECOVERY/.test(effect)) return { type: 'recovery', reason: watch }
    if (/BASE|AEROBIC/.test(effect) && !/ANAEROBIC/.test(effect)) return { type: long ? 'long' : 'easy', reason: watch }
    if (/TEMPO|THRESHOLD/.test(effect)) return { type: long ? 'long' : 'tempo', reason: watch }
    if (/VO2|ANAEROBIC|SPEED|SPRINT/.test(effect)) return { type: 'interval', reason: watch }
  }

  if (s.workout_type === 3) return { type: pace <= h.pace * 0.97 ? 'interval' : 'tempo', reason: 'marquée entraînement sur Strava' }

  const mine = 'selon ton allure habituelle'
  if (long) return { type: 'long', reason: 'plus longue que d’habitude' }
  if (pace <= h.pace * 0.93) return { type: 'tempo', reason: mine }
  if (pace >= h.pace * 1.07) return { type: 'recovery', reason: mine }
  return { type: 'easy', reason: mine }
}

/** Relie une course Strava à l'activité Garmin qui a commencé à moins de 3 minutes d'écart. */
export function matchGarmin(s: StravaRun, garmin: GarminRun[]) {
  const t = Date.parse(s.start_date)
  return garmin.find((g) => Math.abs(Date.parse(`${g.startTimeGMT.replace(' ', 'T')}Z`) - t) < 180_000)
}
