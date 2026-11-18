/** Enregistre la clé API OpenAI (chiffrée dans un cookie httpOnly) après l'avoir vérifiée. */
export default defineEventHandler(async (event) => {
  const body = await readBody<{ key?: string }>(event)
  const key = body?.key?.trim()
  if (!key || !/^sk-[\w-]{20,}$/.test(key)) throw createError({ statusCode: 400, statusMessage: 'Ce n’est pas une clé OpenAI (elle commence par « sk- »)' })
  const model = await checkOpenAiKey(key)
  await (await openaiSession(event)).update({ key, model })
  return { model }
})
