/**
 * Zones cardio d'une course telles que Strava les donne : les seuils du compte du coureur et le temps
 * passé dans chaque zone. Ce sont les zones que Strava affiche : l'appli les reprend au lieu de les calculer.
 * Strava réserve cette lecture à ses abonnés (réponse 402) : ce n'est pas une panne, l'appli calcule alors
 * les zones depuis la FC max. Demandées à l'ouverture d'une course seulement, comme les courbes.
 */
import type { StravaZonesReply } from '#shared/utils/zones'

export default defineEventHandler(async (event): Promise<StravaZonesReply> => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) throw createError({ statusCode: 400, statusMessage: 'Identifiant invalide' })
  try {
    return { available: true, zones: stravaHrZones(await stravaFetch<unknown>(event, `/activities/${id}/zones`)) }
  } catch (e) {
    if (stravaStatus(e) === 402) return { available: false, zones: null }
    throw e
  }
})
