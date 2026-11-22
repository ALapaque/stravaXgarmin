/*
 * Forme des données de l'appli, partagée entre le navigateur, le serveur et la logique pure
 * (mise à niveau de l'état gardé, démo). Uniquement des types.
 */
import type { Lap } from './compliance'
import type { RunType } from './runs'
import type { PlanStep, StepKind } from './workout'

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

/* ───── Plan d'entraînement (calendrier Garmin) ───── */

export type PlanKind = StepKind

export interface PlanLine {
  kind: PlanKind | 'repeat'
  text: string
  reps?: number
  children?: PlanLine[]
}

export interface PlanBlock {
  kind: PlanKind
  sec: number
  /** Intensité relative 0..1 pour le profil de la séance */
  level: number
}

export interface PlanSession {
  id: string
  date: string
  title: string
  description: string | null
  provider: string | null
  durationSec: number | null
  distanceM: number | null
  lines: PlanLine[]
  blocks: PlanBlock[]
  /** Séance Garmin (même identifiant que celui d'une activité qui l'a suivie) */
  workoutId: number | null
  /** Étapes structurées ([] si illisibles ou absentes) */
  steps: PlanStep[]
  /** Séance passée pas encore relue en détail (plus de 12 à lire d'un coup) : relue au prochain passage */
  pending?: boolean
  /** Séance déduite du nom de la montre, absente du calendrier */
  synthetic?: boolean
}

/* ───── Historique, notifications, forme et chaussures ───── */

/** D'où vient un changement fait par l'appli sur Strava ou Garmin */
export type ChangeSource = 'garmin' | 'regle' | 'ia' | 'manuel' | 'record' | 'description' | 'strava' | 'analyse'

export interface HistoryEntry {
  id: string
  activityId: string
  field: 'name' | 'description' | 'garminName'
  /** Valeur complète avant/après (pour une description : toute la description) */
  before: string
  after: string
  /** Description : texte de l'appli ajouté (absent des anciennes entrées : on prend « after ») */
  block?: string
  /** Description : texte de l'appli que ce bloc a remplacé, '' s'il a été ajouté à la suite */
  previousBlock?: string
  source: ChangeSource
  at: string
  undone?: boolean
}

export type NotifKind = 'titles' | 'records' | 'review' | 'recap'

export interface AppNotification {
  id: string
  kind: NotifKind
  title: string
  body: string
  to?: string
  at: string
  read: boolean
}

export interface Forme {
  vo2max: number | null
  status: { label: string; tone: 'ok' | 'warn' | 'ko' | 'idle' } | null
  load: { acute: number; chronic: number | null; ratio: number | null } | null
  readiness: { score: number; level: string } | null
  recoveryHours: number | null
  predictions: Record<EffortKey, number | null> | null
}

export interface Gear {
  id: string
  name: string
  km: number
  primary: boolean
  retired: boolean
}
