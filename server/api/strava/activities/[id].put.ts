/** Modifie le nom et/ou la description d'une activité Strava. */
export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  const body = await readBody<{ name?: string; description?: string }>(event)
  if (!Number.isInteger(id) || id <= 0) throw createError({ statusCode: 400, statusMessage: 'Identifiant invalide' })

  const update: Record<string, string> = {}
  if (typeof body?.name === 'string') {
    const name = body.name.trim()
    if (!name || name.length > 255) throw createError({ statusCode: 400, statusMessage: 'Nom vide ou trop long' })
    update.name = name
  }
  if (typeof body?.description === 'string') update.description = body.description.slice(0, 5000)
  if (!Object.keys(update).length) throw createError({ statusCode: 400, statusMessage: 'Rien à modifier' })

  const a = await stravaFetch<{ id: number; name: string; description: string | null }>(event, `/activities/${id}`, { method: 'PUT', body: update })
  return { id: a.id, name: a.name, description: a.description }
})
