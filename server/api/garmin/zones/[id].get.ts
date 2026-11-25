/**
 * Zones et temps par zone d'une activité Garmin (API non officielle de Garmin Connect) : les zones de la
 * montre au moment de la course, et le temps qu'elle a compté dans chacune. C'est ce que Garmin Connect affiche.
 * Demandées à l'ouverture d'une course seulement. Lecture défensive : une réponse illisible est une erreur
 * dite clairement, l'appli se rabat alors sur les zones réglées sur la montre.
 */
import type { WatchRunZonesReply } from '#shared/utils/zones'

const ACTIVITY_URL = 'https://connectapi.garmin.com/activity-service/activity'

export default defineEventHandler(async (event): Promise<WatchRunZonesReply> => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) throw createError({ statusCode: 400, statusMessage: 'Identifiant invalide' })
  const gc = await garminClient(event)
  const raw = await garminCall(() => gc.get<unknown>(`${ACTIVITY_URL}/${id}/hrTimeInZones`))
  const zones = garminRunZones(raw)
  const empty = raw === null || raw === undefined || raw === '' || (Array.isArray(raw) && !raw.length)
  // Une réponse non vide mais illisible : Garmin a changé sa façon de répondre
  if (!zones && !empty) throw createError({ statusCode: 502, statusMessage: 'Garmin ne répond pas comme prévu : temps par zone illisible' })
  return { zones }
})
