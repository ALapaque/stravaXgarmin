/*
 * IA avec la clé de l'utilisateur, chez le fournisseur qu'il a choisi.
 * Gemini, Mistral et OpenAI parlent tous le format « chat completions » d'OpenAI :
 * un seul code, une adresse et une liste de modèles par fournisseur.
 * Rien n'est gardé chez nous : la clé vit dans un cookie chiffré.
 */
import type { H3Event } from 'h3'

export type AiProvider = 'gemini' | 'mistral' | 'openai'

interface ProviderConfig {
  label: string
  base: string
  /** Modèles rapides et peu chers (ou gratuits), par ordre de préférence */
  preferred: string[]
  /** Autres modèles acceptés, essayés du plus récent au plus ancien */
  fallback: RegExp
  billing: string
}

export const PROVIDERS: Record<AiProvider, ProviderConfig> = {
  gemini: {
    label: 'Gemini',
    base: 'https://generativelanguage.googleapis.com/v1beta/openai',
    // Google retire vite les anciens modèles aux nouveaux comptes : on prend les plus récents de la liste
    preferred: ['gemini-flash-lite-latest'],
    fallback: /^gemini-\d+(\.\d+)?-flash(-lite)?(-preview)?$/,
    billing: 'quota gratuit de Gemini atteint pour aujourd’hui, réessaie plus tard',
  },
  mistral: {
    label: 'Mistral',
    base: 'https://api.mistral.ai/v1',
    preferred: ['mistral-small-latest', 'mistral-medium-latest', 'ministral-8b-latest'],
    fallback: /^(mistral-small|mistral-medium|ministral)/,
    billing: 'quota gratuit de Mistral atteint, réessaie plus tard',
  },
  openai: {
    label: 'OpenAI',
    base: 'https://api.openai.com/v1',
    preferred: ['gpt-5.4-mini', 'gpt-5-mini', 'gpt-5.4-nano', 'gpt-5-nano', 'gpt-4.1-mini', 'gpt-4o-mini'],
    fallback: /^gpt-[\d.]+-mini$/,
    billing: 'pas de crédit utilisable sur ton compte OpenAI : ajoute-en dans Billing (un crédit tout juste ajouté peut prendre quelques minutes)',
  },
}

export const isProvider = (p: unknown): p is AiProvider => typeof p === 'string' && p in PROVIDERS

async function call(url: string, init: RequestInit, label: string) {
  try {
    return await fetch(url, init)
  } catch {
    throw createError({ statusCode: 502, statusMessage: `Impossible de joindre ${label}, réessaie dans un instant` })
  }
}

type ErrBody = { error?: { code?: string | number; type?: string; message?: string; status?: string } } | { message?: string } | undefined

function errorInfo(body: ErrBody) {
  const b = (Array.isArray(body) ? body[0] : body) as Record<string, unknown> | undefined
  const e = (b?.error ?? b ?? {}) as { code?: unknown; type?: string; message?: string; status?: string }
  return { code: String(e.code ?? e.status ?? e.type ?? ''), message: String(e.message ?? '') }
}

function apiError(p: AiProvider, status: number, body: ErrBody): never {
  const { label, billing } = PROVIDERS[p]
  const { code, message } = errorInfo(body)
  console.warn('[ia]', p, status, code, message.slice(0, 200))
  if (status === 401 || (status === 400 && /api key|api_key/i.test(message)) || status === 403) {
    throw createError({ statusCode: 401, statusMessage: `Clé ${label} refusée : vérifie-la ou crées-en une nouvelle` })
  }
  if (status === 402 || /insufficient_quota|billing|credit/i.test(`${code} ${message}`)) {
    throw createError({ statusCode: 402, statusMessage: billing.charAt(0).toUpperCase() + billing.slice(1) })
  }
  if (status === 429) {
    throw createError({ statusCode: 429, statusMessage: `${label} limite les demandes${/day|daily|per_day|PerDay/i.test(message) ? ' pour aujourd’hui' : ', réessaie dans une minute'}` })
  }
  throw createError({ statusCode: 502, statusMessage: `${label} ne répond pas comme prévu${message ? ` : ${message.slice(0, 120)}` : ''}` })
}

const version = (id: string) => Number(id.match(/-(\d+(?:\.\d+)?)/)?.[1] ?? 0)

/** Modèles candidats : la liste préférée, puis les légers du plus récent au plus ancien, puis les standards. */
function candidates(cfg: ProviderConfig, ids: string[]) {
  const others = ids
    .filter((id) => cfg.fallback.test(id) && !cfg.preferred.includes(id))
    .sort((a, b) => {
      const preview = Number(a.includes('preview')) - Number(b.includes('preview'))
      if (preview) return preview
      // Les « lite » d'abord : moins chers, quotas gratuits plus larges, assez bons pour des titres
      const lite = Number(b.includes('lite')) - Number(a.includes('lite'))
      return lite || version(b) - version(a)
    })
  return [...cfg.preferred.filter((m) => ids.includes(m)), ...others]
}

const gone = (message: string) => /no longer available|not found|does not exist|deprecated|not supported|unknown model|invalid model/i.test(message)

/** Petit essai : le modèle répond-il vraiment avec cette clé ? (une liste de modèles peut en contenir de fermés) */
async function works(p: AiProvider, key: string, model: string) {
  const cfg = PROVIDERS[p]
  const res = await call(
    `${cfg.base}/chat/completions`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: 'Réponds juste « ok ».' }], ...(p === 'openai' ? { store: false } : {}) }),
    },
    cfg.label,
  )
  if (res.ok) return true
  const body = await res.json().catch(() => undefined)
  const { message } = errorInfo(body)
  if ((res.status === 404 || res.status === 400) && gone(message)) return false
  // Limite atteinte : le modèle existe bien, on le garde
  if (res.status === 429 && !/limit: 0|free_tier.*0/i.test(message)) return true
  if (res.status === 429 || res.status === 403 || res.status === 404) return false
  apiError(p, res.status, body)
}

/** Vérifie la clé et choisit le premier modèle qui répond vraiment. */
export async function checkAiKey(p: AiProvider, key: string, skip: string[] = []) {
  const cfg = PROVIDERS[p]
  const res = await call(`${cfg.base}/models`, { headers: { Authorization: `Bearer ${key}` } }, cfg.label)
  const body = await res.json().catch(() => undefined)
  if (!res.ok) apiError(p, res.status, body)
  const ids = ((body?.data ?? []) as { id: string }[]).map((m) => m.id.replace(/^models\//, ''))
  for (const model of candidates(cfg, ids).filter((m) => !skip.includes(m)).slice(0, 6)) {
    if (await works(p, key, model)) return model
  }
  throw createError({ statusCode: 422, statusMessage: `Aucun modèle ${cfg.label} utilisable avec cette clé pour le moment` })
}

export async function aiJson<T>(
  event: H3Event,
  opts: { name: string; schema: Record<string, unknown>; instructions: string; input: string },
): Promise<T> {
  const session = await aiSession(event)
  const { provider, key } = session.data
  let model = session.data.model
  if (!provider || !key || !model || !isProvider(provider)) {
    throw createError({ statusCode: 401, statusMessage: 'Active d’abord l’IA dans les réglages' })
  }
  const cfg = PROVIDERS[provider]

  const send = (strict: boolean) =>
    call(
      `${cfg.base}/chat/completions`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          ...(provider === 'openai' ? { store: false } : {}),
          messages: [
            {
              role: 'system',
              content: strict
                ? opts.instructions
                : `${opts.instructions}\n\nRéponds uniquement avec un objet JSON valide qui respecte ce schéma : ${JSON.stringify(opts.schema)}`,
            },
            { role: 'user', content: opts.input },
          ],
          response_format: strict
            ? { type: 'json_schema', json_schema: { name: opts.name, schema: opts.schema, strict: true } }
            : { type: 'json_object' },
        }),
      },
      cfg.label,
    )

  let res = await send(true)
  // Schéma strict pas accepté par ce fournisseur ou ce modèle : JSON simple, schéma dans la consigne
  if (res.status === 400) res = await send(false)
  let body = await res.json().catch(() => undefined)

  // Modèle retiré entre-temps (Google le fait souvent) : on en choisit un autre et on réessaie une fois
  if ((res.status === 404 || res.status === 400) && gone(errorInfo(body).message)) {
    const next = await checkAiKey(provider, key, [model])
    await session.update({ model: next })
    model = next
    res = await send(true)
    if (res.status === 400) res = await send(false)
    body = await res.json().catch(() => undefined)
  }
  if (!res.ok) {
    // Clé révoquée : on l'oublie pour que l'appli en redemande une
    if (res.status === 401) await session.clear()
    apiError(provider, res.status, body)
  }
  const text: string | undefined = body?.choices?.[0]?.message?.content
  if (!text) throw createError({ statusCode: 502, statusMessage: `${cfg.label} n’a pas renvoyé de réponse` })
  try {
    return JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, '')) as T
  } catch {
    throw createError({ statusCode: 502, statusMessage: `${cfg.label} a renvoyé une réponse illisible, réessaie` })
  }
}

/** Résumé lisible d'une course pour le modèle. */
export interface RunInput {
  type?: string
  startedAt?: string
  place?: string
  distanceKm?: number
  durationSec?: number
  avgHr?: number
  elevationM?: number
  splits?: number[]
  garminName?: string
  stravaId?: number
}

const pace = (sec: number, km: number) => {
  const p = Math.round(sec / Math.max(km, 0.01))
  return `${Math.floor(p / 60)}:${String(p % 60).padStart(2, '0')} /km`
}
const dur = (s: number) => `${Math.floor(s / 3600) ? `${Math.floor(s / 3600)} h ` : ''}${Math.floor((s % 3600) / 60)} min ${s % 60} s`

export function describeRun(r: RunInput, details?: StravaDetails) {
  const km = Number(r.distanceKm ?? 0)
  const sec = Number(r.durationSec ?? 0)
  const lines = [
    `Nom sur la montre : ${String(r.garminName ?? '').slice(0, 100)}`,
    r.startedAt ? `Date : ${String(r.startedAt).slice(0, 16).replace('T', ' ')}` : '',
    r.place ? `Lieu : ${String(r.place).slice(0, 60)}` : '',
    `Distance : ${km.toFixed(2)} km, durée ${dur(sec)}, allure moyenne ${pace(sec, km)}`,
    r.avgHr ? `FC moyenne : ${r.avgHr} bpm${details?.max_heartrate ? `, max ${Math.round(details.max_heartrate)} bpm` : ''}` : '',
    r.elevationM ? `Dénivelé : ${r.elevationM} m` : '',
    r.type ? `Type estimé : ${r.type}` : '',
  ]
  const splits = details?.splits_metric?.filter((s) => s.distance > 900)
  if (splits?.length) {
    lines.push(
      `Kilomètres : ${splits.map((s) => `${pace(s.moving_time, s.distance / 1000)}${s.average_heartrate ? ` (${Math.round(s.average_heartrate)} bpm)` : ''}`).join(', ')}`,
    )
  } else if (r.splits?.length) {
    lines.push(`Kilomètres : ${r.splits.slice(0, 60).map((s) => pace(Number(s), 1)).join(', ')}`)
  }
  const laps = details?.laps
  if (laps && laps.length > 1 && laps.length <= 40) {
    lines.push(
      `Tours : ${laps.map((l) => `${Math.round(l.distance)} m en ${pace(l.moving_time, l.distance / 1000)}${l.average_heartrate ? ` ${Math.round(l.average_heartrate)} bpm` : ''}`).join(' | ')}`,
    )
  }
  return lines.filter(Boolean).join('\n')
}

export interface StravaDetails {
  max_heartrate?: number
  splits_metric?: { distance: number; moving_time: number; average_heartrate?: number }[]
  laps?: { distance: number; moving_time: number; average_heartrate?: number }[]
}

/** Détail Strava (tours, kilomètres, FC) quand la course vient de Strava ; sinon rien. */
export async function stravaDetails(event: H3Event, id?: number) {
  if (!id || !Number.isInteger(Number(id))) return undefined
  try {
    return await stravaFetch<StravaDetails>(event, `/activities/${Number(id)}`)
  } catch {
    return undefined
  }
}
