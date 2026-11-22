/**
 * Courbes d'une course (temps, cardio, vitesse, distance), réduites à 240 points.
 * Demandées à la demande seulement (jamais pendant la synchro), pour ménager la limite Strava.
 */
export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) throw createError({ statusCode: 400, statusMessage: 'Identifiant invalide' })
  const raw = await stravaFetch<Record<string, { data?: unknown }>>(event, `/activities/${id}/streams`, {
    query: { keys: 'time,heartrate,velocity_smooth,distance', key_by_type: 'true' },
  })
  // Strava répond parfois par une liste au lieu d'un objet par type : on la remet en forme
  const byType = Array.isArray(raw)
    ? Object.fromEntries((raw as { type?: string; data?: unknown }[]).filter((s) => s?.type).map((s) => [s.type!, s]))
    : raw
  return toRunStream(byType, 240)
})
