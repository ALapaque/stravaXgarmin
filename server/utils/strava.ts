import type { H3Event } from 'h3'

const API = 'https://www.strava.com/api/v3'
const TOKEN_URL = 'https://www.strava.com/oauth/token'

export function stravaCredentials() {
  const { strava } = useRuntimeConfig()
  if (!strava.clientId || !strava.clientSecret) {
    throw createError({ statusCode: 500, statusMessage: 'NUXT_STRAVA_CLIENT_ID / NUXT_STRAVA_CLIENT_SECRET manquants' })
  }
  return strava
}

interface TokenResponse {
  access_token: string
  refresh_token: string
  expires_at: number
  athlete?: { id: number; firstname?: string; lastname?: string }
}

export async function exchangeStravaCode(code: string) {
  const { clientId, clientSecret } = stravaCredentials()
  return $fetch<TokenResponse>(TOKEN_URL, {
    method: 'POST',
    body: { client_id: clientId, client_secret: clientSecret, code, grant_type: 'authorization_code' },
  })
}

/** Jeton valide pour l'utilisateur courant, rafraîchi s'il expire dans moins d'une minute. */
async function accessToken(event: H3Event) {
  const session = await stravaSession(event)
  const { accessToken, refreshToken, expiresAt } = session.data
  if (!accessToken || !refreshToken) throw createError({ statusCode: 401, statusMessage: 'Strava non connecté' })
  if (expiresAt && expiresAt - 60 > Date.now() / 1000) return accessToken

  const { clientId, clientSecret } = stravaCredentials()
  const t = await $fetch<TokenResponse>(TOKEN_URL, {
    method: 'POST',
    body: { client_id: clientId, client_secret: clientSecret, grant_type: 'refresh_token', refresh_token: refreshToken },
  })
  await session.update({ accessToken: t.access_token, refreshToken: t.refresh_token, expiresAt: t.expires_at })
  return t.access_token
}

export async function stravaFetch<T>(
  event: H3Event,
  path: string,
  opts: { method?: 'GET' | 'PUT'; body?: Record<string, unknown>; query?: Record<string, unknown> } = {},
): Promise<T> {
  const token = await accessToken(event)
  try {
    return (await $fetch(`${API}${path}`, { ...opts, headers: { Authorization: `Bearer ${token}` } })) as T
  } catch (e: unknown) {
    const status = (e as { statusCode?: number }).statusCode ?? 502
    if (status === 429) throw createError({ statusCode: 429, statusMessage: 'Strava limite les demandes, réessaie dans un quart d’heure' })
    // « upstream » : le code d'origine, pour les routes qui doivent distinguer un refus attendu d'une panne
    throw createError({ statusCode: status === 401 ? 401 : 502, statusMessage: `Strava a refusé la requête (${status})`, data: { upstream: status } })
  }
}

/** Code HTTP répondu par Strava dans une erreur levée par stravaFetch (null si ce n'en est pas une). */
export function stravaStatus(e: unknown): number | null {
  const up = (e as { data?: { upstream?: unknown } } | null)?.data?.upstream
  return typeof up === 'number' ? up : null
}

/** Champ utile d'une activité Strava (GET /athlete/activities). */
export interface StravaActivity {
  id: number
  name: string
  sport_type: string
  start_date: string
  distance: number
  moving_time: number
  elapsed_time: number
  total_elevation_gain: number
  average_heartrate?: number
  max_heartrate?: number
  start_date_local?: string
  trainer?: boolean
  workout_type?: number | null
  location_city?: string | null
}
