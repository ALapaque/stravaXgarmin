/** Retour de Strava : échange le code contre des jetons, gardés dans le cookie chiffré. */
export default defineEventHandler(async (event) => {
  const { code, state, error, scope } = getQuery(event)
  const session = await stravaSession(event)

  if (error || !code) return sendRedirect(event, '/connexion?erreur=strava-refus')
  if (!state || state !== session.data.oauthState) return sendRedirect(event, '/connexion?erreur=strava-etat')
  if (!String(scope ?? '').includes('activity:write')) return sendRedirect(event, '/connexion?erreur=strava-permissions')

  const t = await exchangeStravaCode(String(code))
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
