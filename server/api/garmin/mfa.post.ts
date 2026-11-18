/** Étape 2 de la connexion Garmin : le code reçu par e-mail ou dans l'appli. */
export default defineEventHandler(async (event) => {
  const body = await readBody<{ code?: string }>(event)
  const code = body?.code?.replace(/\s/g, '')
  if (!code || !/^\d{4,8}$/.test(code)) throw createError({ statusCode: 400, statusMessage: 'Code invalide' })
  await finishGarminMfa(event, code)
  return { status: 'ok' }
})
