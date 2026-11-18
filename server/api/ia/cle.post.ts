/** Enregistre la clé du fournisseur d'IA choisi (chiffrée dans un cookie httpOnly) après l'avoir vérifiée. */
export default defineEventHandler(async (event) => {
  const body = await readBody<{ provider?: string; key?: string }>(event)
  const provider = body?.provider
  const key = body?.key?.trim()
  if (!isProvider(provider)) throw createError({ statusCode: 400, statusMessage: 'Choisis un fournisseur d’IA' })
  if (!key || key.length < 20 || /\s/.test(key)) throw createError({ statusCode: 400, statusMessage: 'Cette clé ne semble pas complète' })
  const model = await checkAiKey(provider, key)
  await (await aiSession(event)).update({ provider, key, model })
  return { provider, model }
})
