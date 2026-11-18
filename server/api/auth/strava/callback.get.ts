/** Retour de Strava : échange le code contre des jetons, gardés dans le cookie chiffré. */
export default defineEventHandler(async (event) => {
  const { code, state, error, scope } = getQuery(event)
  const session = await stravaSession(event)

  if (error || !code) return sendRedirect(event, '/connexion?erreur=strava-refus')
  // Sur iPhone, l'appli installée et le navigateur intégré peuvent recevoir ce retour tous les deux :
  // si la première requête a déjà connecté le compte, la seconde mène simplement à l'accueil
  if (session.data.refreshToken && (!state || state !== session.data.oauthState)) return sendRedirect(event, '/?connecte=strava')
  if (!state || state !== session.data.oauthState) return sendRedirect(event, '/connexion?erreur=strava-etat')
  if (!String(scope ?? '').includes('activity:write')) return sendRedirect(event, '/connexion?erreur=strava-permissions')

  let t: Awaited<ReturnType<typeof exchangeStravaCode>>
  try {
    t = await exchangeStravaCode(String(code))
  } catch {
    // Code déjà utilisé par l'autre requête : déjà connecté, ou à refaire
    return sendRedirect(event, session.data.refreshToken ? '/?connecte=strava' : '/connexion?erreur=strava-etat')
  }
  await session.update({
    accessToken: t.access_token,
    refreshToken: t.refresh_token,
    expiresAt: t.expires_at,
    athleteId: t.athlete?.id,
    athleteName: [t.athlete?.firstname, t.athlete?.lastname].filter(Boolean).join(' ') || undefined,
    oauthState: undefined,
  })
  return sendRedirect(event, '/?connecte=strava')
})
