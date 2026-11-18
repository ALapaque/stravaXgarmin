/** Étape 1 de la connexion Garmin. Le mot de passe sert une fois et n'est jamais stocké. */
export default defineEventHandler(async (event) => {
  const body = await readBody<{ email?: string; password?: string }>(event)
  const email = body?.email?.trim()
  const password = body?.password
  if (!email || !password) throw createError({ statusCode: 400, statusMessage: 'E-mail et mot de passe requis' })
  const status = await startGarminLogin(event, email, password)
  return { status }
})
