/*
 * Sessions chiffrées stockées dans des cookies httpOnly (pas de base de données).
 * Chaque navigateur porte ses propres jetons ; seules les routes serveur peuvent les lire.
 */
import type { H3Event, SessionConfig } from 'h3'
import type { IOauth1Token } from '@flow-js/garmin-connect/dist/garmin/types'

export interface StravaSession {
  accessToken?: string
  refreshToken?: string
  expiresAt?: number
  athleteId?: number
  athleteName?: string
  oauthState?: string
}

export interface GarminSession {
  oauth1?: IOauth1Token
  displayName?: string
}

/** Clé API OpenAI de l'utilisateur, chiffrée dans un cookie httpOnly (jamais renvoyée au navigateur). */
export interface OpenAiSession {
  key?: string
  model?: string
}

/** État temporaire entre le mot de passe et le code 2FA (10 minutes max). */
export interface GarminMfaSession {
  cookies?: Record<string, string>
  loginParams?: Record<string, string>
  mfaMethod?: string
  /** Connexion passée par la page web de Garmin (secours quand l'API mobile refuse) */
  widget?: { csrf: string; params: Record<string, string> }
}

function config(name: string, maxAge: number): SessionConfig {
  const { sessionPassword } = useRuntimeConfig()
  if (!sessionPassword || sessionPassword.length < 32) {
    throw createError({
      statusCode: 500,
      statusMessage: 'NUXT_SESSION_PASSWORD manquant ou trop court (32 caractères minimum)',
    })
  }
  return {
    name,
    password: sessionPassword,
    maxAge,
    sessionHeader: false,
    cookie: { httpOnly: true, secure: !import.meta.dev, sameSite: 'lax', path: '/' },
  }
}

const YEAR = 60 * 60 * 24 * 365

export const stravaSession = (event: H3Event) => useSession<StravaSession>(event, config('sxg-strava', YEAR))
export const garminSession = (event: H3Event) => useSession<GarminSession>(event, config('sxg-garmin', YEAR))
export const garminMfaSession = (event: H3Event) => useSession<GarminMfaSession>(event, config('sxg-garmin-mfa', 600))
export const openaiSession = (event: H3Event) => useSession<OpenAiSession>(event, config('sxg-openai', YEAR))
