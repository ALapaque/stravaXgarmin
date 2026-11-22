/*
 * Forme des données de l'appli, partagée entre le navigateur, le serveur et la logique pure
 * (mise à niveau de l'état gardé, démo). Uniquement des types.
 */
import type { Lap } from './compliance'
import type { RunType } from './runs'

export type EffortKey = '5k' | '10k' | 'half' | 'marathon'

/** Sport Strava d'une course */
export type RunSport = 'Run' | 'TrailRun' | 'VirtualRun'

export interface Weather {
  tempC: number
  sky: string
  windKmh: number
}

export interface Shoe {
  name: string
  km: number
}

export interface Activity {
  id: string
  type: RunType
  startedAt: string
  /** Jour de la course à l'heure locale (AAAA-MM-JJ), pour la relier au plan */
  localDate: string
  /** Séance sur tapis : pas de carte, pas de lieu */
  indoor: boolean
  sport: RunSport
  /** « tapis » pour une séance sur tapis */
  place: string
  distanceKm: number
  /** Temps en mouvement */
  durationSec: number
  /** Temps écoulé, pauses comprises */
  elapsedSec: number
  avgHr: number
  maxHr?: number
  elevationM: number
  /** Temps de chaque kilomètre complet, en secondes */
  splits: number[]
  /** FC moyenne de chaque kilomètre complet (même longueur que splits, 0 si absente) */
  splitHr?: number[]
  /** Tours de la montre (détail Strava) */
  laps?: Lap[]
  /** Type d'entraînement Strava (1 = course, 2 = sortie longue, 3 = entraînement) */
  workoutType?: number
  weather?: Weather
  shoe?: Shoe
  /** Meilleurs efforts dans la course (Strava les calcule : best_efforts) */
  bestEfforts: Partial<Record<EffortKey, number>>
  /** Identifiant Strava de la paire de chaussures utilisée */
  gearId?: string
  /** Pourquoi ce type : « selon ta montre », « selon ton allure »… */
  typeReason?: string
  /** Type deviné par l'appli, gardé quand tu en choisis un autre (pour pouvoir revenir en arrière) */
  autoType?: RunType
  autoReason?: string
  /** Tracé GPS simplifié (polyline encodée de Strava) */
  route?: string
  /** Distances où Strava a compté cette course comme record personnel (pr_rank = 1) */
  prs?: EffortKey[]
  garminName: string
  stravaName: string
  stravaDescription?: string
  /** Identifiants réels quand les données viennent des API (absents en mode démo) */
  stravaId?: number
  garminId?: number
  /** Séance Garmin suivie pendant la course, si Garmin le dit */
  garminWorkoutId?: number
}
