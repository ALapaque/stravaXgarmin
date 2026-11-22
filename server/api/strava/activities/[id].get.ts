/**
 * Nom et description d'une activité, lus à l'instant chez Strava.
 * La description revient avec des fins de ligne « \n » (Strava renvoie des « \r\n »).
 */
export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) throw createError({ statusCode: 400, statusMessage: 'Identifiant invalide' })
  const a = await stravaFetch<{ id: number; name: string; description: string | null }>(event, `/activities/${id}`)
  return { id: a.id, name: a.name, description: normalizeNewlines(a.description) }
})
