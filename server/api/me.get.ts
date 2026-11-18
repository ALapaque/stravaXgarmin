/** Comptes connectés pour ce navigateur (aucun jeton renvoyé au client). */
export default defineEventHandler(async (event) => {
  const strava = (await stravaSession(event)).data
  const garmin = (await garminSession(event)).data
  const openai = (await openaiSession(event)).data
  return {
    strava: { connected: Boolean(strava.refreshToken), name: strava.athleteName ?? null },
    garmin: { connected: Boolean(garmin.oauth1), name: garmin.displayName ?? null },
    openai: { connected: Boolean(openai.key), name: openai.model ?? null },
  }
})
