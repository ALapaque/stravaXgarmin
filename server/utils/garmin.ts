/*
 * Garmin Connect via son API interne (non officielle), avec @flow-js/garmin-connect.
 * Peut casser si Garmin change son fonctionnement ; à utiliser pour son propre compte.
 *
 * La connexion 2FA est coupée en deux requêtes, car deux appels serverless ne
 * partagent pas la mémoire : on garde les cookies SSO de Garmin, chiffrés, entre
 * l'envoi du mot de passe et celui du code.
 */
import type { H3Event } from 'h3'
// Module CommonJS : import par défaut puis déstructuration (sinon erreur en ESM sur Vercel)
import garminPkg from '@flow-js/garmin-connect'
import type { GarminConnect as GarminConnectType } from '@flow-js/garmin-connect'

const { GarminConnect } = garminPkg
type GarminConnect = GarminConnectType
import type { IOauth1Token, IOauth2Token } from '@flow-js/garmin-connect/dist/garmin/types'

/** Méthodes internes du client HTTP de la bibliothèque dont on a besoin. */
interface InternalClient {
  cookies: Record<string, string>
  url: { MOBILE_SERVICE_URL: string }
  fetchOauthConsumer(): Promise<void>
  handleMFA(loginParams: Record<string, string>, mfaMethod: string, options?: { mfaHandler: () => Promise<string> }): Promise<string>
  getOauth1Token(ticket: string, loginUrl?: string): Promise<unknown>
  exchange(oauth1: unknown): Promise<void>
  oauth1Token?: IOauth1Token
}

const internal = (gc: GarminConnect) => gc.client as unknown as InternalClient

class MfaRequired extends Error {
  constructor(public state: { cookies: Record<string, string>; loginParams: Record<string, string>; mfaMethod: string }) {
    super('MFA_REQUIRED')
  }
}

function friendly(e: unknown): never {
  const status = (e as { response?: { status?: number } }).response?.status
  const msg = (e as Error).message ?? ''
  if (status === 429) throw createError({ statusCode: 429, statusMessage: 'Garmin limite les connexions, réessaie dans quelques minutes' })
  if (status === 403) throw createError({ statusCode: 403, statusMessage: 'Garmin a bloqué la connexion depuis ce serveur' })
  if (/password|login failed/i.test(msg)) throw createError({ statusCode: 401, statusMessage: 'E-mail, mot de passe ou code incorrect' })
  throw createError({ statusCode: 502, statusMessage: `Garmin ne répond pas comme prévu : ${msg.slice(0, 120)}` })
}

/** Étape 1 : e-mail + mot de passe. Renvoie « ok » ou « mfa » (code envoyé par Garmin). */
export async function startGarminLogin(event: H3Event, email: string, password: string): Promise<'ok' | 'mfa'> {
  const gc = new GarminConnect({ username: email, password })
  const client = internal(gc)
  // Interception du moment où Garmin demande le code : on sauve la session SSO et on s'arrête là
  client.handleMFA = async (loginParams, mfaMethod) => {
    throw new MfaRequired({ cookies: { ...client.cookies }, loginParams, mfaMethod })
  }
  try {
    await gc.login(email, password)
  } catch (e) {
    if (e instanceof MfaRequired) {
      const mfa = await garminMfaSession(event)
      await mfa.update(e.state)
      return 'mfa'
    }
    friendly(e)
  }
  await saveGarminTokens(event, gc)
  return 'ok'
}

/** Étape 2 : code 2FA, avec la session SSO gardée à l'étape 1. */
export async function finishGarminMfa(event: H3Event, code: string) {
  const mfa = await garminMfaSession(event)
  const { cookies, loginParams, mfaMethod } = mfa.data
  if (!cookies || !loginParams || !mfaMethod) {
    throw createError({ statusCode: 410, statusMessage: 'Code expiré, recommence la connexion' })
  }
  const gc = new GarminConnect({ username: '', password: '' })
  const client = internal(gc)
  try {
    await client.fetchOauthConsumer()
    client.cookies = { ...cookies }
    const ticket = await client.handleMFA(loginParams, mfaMethod, { mfaHandler: async () => code })
    const oauth1 = await client.getOauth1Token(ticket, client.url.MOBILE_SERVICE_URL)
    await client.exchange(oauth1)
  } catch (e) {
    friendly(e)
  }
  await mfa.clear()
  await saveGarminTokens(event, gc)
}

async function saveGarminTokens(event: H3Event, gc: GarminConnect) {
  // Seul le jeton OAuth1 (longue durée, petit) est gardé ; l'OAuth2 est régénéré à chaque requête
  const { oauth1 } = gc.exportToken()
  let displayName: string | undefined
  try {
    const profile = (await gc.getUserProfile()) as { displayName?: string; fullName?: string }
    displayName = profile.fullName || profile.displayName
  } catch {
    /* le nom est un bonus */
  }
  const session = await garminSession(event)
  await session.update({ oauth1, displayName })
}

/** Client Garmin authentifié pour l'utilisateur courant. */
export async function garminClient(event: H3Event) {
  const session = await garminSession(event)
  if (!session.data.oauth1) throw createError({ statusCode: 401, statusMessage: 'Garmin non connecté' })
  const gc = new GarminConnect({ username: '', password: '' })
  // OAuth2 marqué expiré : la bibliothèque l'échange contre un neuf au premier appel
  gc.loadToken(session.data.oauth1, { expires_at: 0 } as IOauth2Token)
  return gc
}

export async function garminCall<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (e) {
    friendly(e)
  }
}
