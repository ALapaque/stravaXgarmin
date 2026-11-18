/** Comptes connectés pour ce navigateur (aucun jeton renvoyé au client). */
export default defineEventHandler(async (event) => {
  const strava = (await stravaSession(event)).data
  const garmin = (await garminSession(event)).data
  const ai = (await aiSession(event)).data
  return {
    strava: { connected: Boolean(strava.refreshToken), name: strava.athleteName ?? null },
    garmin: { connected: Boolean(garmin.oauth1), name: garmin.displayName ?? null },
    ai: {
      connected: Boolean(ai.key),
      provider: ai.provider ?? null,
      name: ai.provider && isProvider(ai.provider) ? `${PROVIDERS[ai.provider].label} · ${ai.model}` : null,
    },
  }
})
