/**
 * Zones cardio réglées sur la montre (API non officielle de Garmin Connect) : le profil course à pied,
 * sinon le profil général. Ce sont les zones que la montre annonce pendant la course.
 * Lecture défensive : une réponse illisible est une erreur dite clairement (elle remonte dans l'état
 * des connexions), jamais des zones inventées.
 */
import type { WatchZonesReply } from '#shared/utils/zones'

const ZONES_URL = 'https://connectapi.garmin.com/biometric-service/heartRateZones'

export default defineEventHandler(async (event): Promise<WatchZonesReply> => {
  const gc = await garminClient(event)
  const raw = await garminCall(() => gc.get<unknown>(ZONES_URL))
  const zones = garminAccountZones(raw)
  const empty = raw === null || raw === undefined || raw === '' || (Array.isArray(raw) && !raw.length)
  // Une réponse non vide dont aucun seuil n'est lisible : Garmin a changé sa façon de répondre
  if (!zones && !empty) throw createError({ statusCode: 502, statusMessage: 'Garmin ne répond pas comme prévu : zones illisibles' })
  return { zones }
})
