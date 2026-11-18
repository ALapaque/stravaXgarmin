/** Renomme une activité dans Garmin Connect (API non officielle). */
export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  const body = await readBody<{ name?: string }>(event)
  const name = body?.name?.trim()
  if (!Number.isInteger(id) || id <= 0) throw createError({ statusCode: 400, statusMessage: 'Identifiant invalide' })
  if (!name || name.length > 255) throw createError({ statusCode: 400, statusMessage: 'Nom vide ou trop long' })
  const gc = await garminClient(event)
  await garminCall(() => gc.renameActivity(id, name))
  return { id, name }
})
