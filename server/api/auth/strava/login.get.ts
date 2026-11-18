/** Redirige vers l'écran d'autorisation Strava. */
export default defineEventHandler(async (event) => {
  const { clientId } = stravaCredentials()
  const state = crypto.randomUUID()
  await (await stravaSession(event)).update({ oauthState: state })
  const redirect = `${getRequestURL(event).origin}/api/auth/strava/callback`
  const url = new URL('https://www.strava.com/oauth/authorize')
  url.search = new URLSearchParams({
    client_id: String(clientId),
    redirect_uri: redirect,
    response_type: 'code',
    approval_prompt: 'auto',
    scope: 'read,activity:read_all,activity:write',
    state,
  }).toString()
  return sendRedirect(event, url.toString())
})
