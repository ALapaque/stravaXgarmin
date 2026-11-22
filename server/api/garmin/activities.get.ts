/** 60 dernières activités Garmin (nom, début, distance) pour les relier à Strava. */
export default defineEventHandler(async (event) => {
  const gc = await garminClient(event)
  const list = await garminCall(() => gc.getActivities(0, 60))
  return list.map((a) => ({
    id: a.activityId,
    name: a.activityName,
    startTimeGMT: a.startTimeGMT,
    distance: a.distance,
    type: a.activityType?.typeKey,
    // Effet principal calculé par la montre (récupération, endurance, tempo, seuil, VO2max…)
    effect: (a as { trainingEffectLabel?: string | null }).trainingEffectLabel ?? null,
    // Séance du calendrier suivie pendant la course (champ pas toujours présent : lecture défensive)
    workoutId: workoutIdOf(a),
  }))
})

function workoutIdOf(a: unknown): number | null {
  const o = a as { workoutId?: unknown; associatedWorkoutId?: unknown }
  for (const v of [o.workoutId, o.associatedWorkoutId]) {
    const n = Number(v)
    if (v !== null && v !== undefined && Number.isInteger(n) && n > 0) return n
  }
  return null
}
