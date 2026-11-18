/*
 * Appels à l'API OpenAI avec la clé de l'utilisateur (Responses API, sortie JSON stricte).
 * Rien n'est gardé chez OpenAI (store: false) ni chez nous : la clé vit dans un cookie chiffré.
 */
import type { H3Event } from 'h3'

const API = 'https://api.openai.com/v1'

async function call(url: string, init: RequestInit) {
  try {
    return await fetch(url, init)
  } catch {
    throw createError({ statusCode: 502, statusMessage: 'Impossible de joindre OpenAI, réessaie dans un instant' })
  }
}

/** Modèles rapides et peu chers, par ordre de préférence : on prend le premier que la clé peut utiliser. */
const PREFERRED = ['gpt-5.4-mini', 'gpt-5-mini', 'gpt-5.4-nano', 'gpt-5-nano', 'gpt-4.1-mini', 'gpt-4o-mini']

function apiError(status: number, body: { error?: { code?: string; message?: string } } | undefined): never {
  const code = body?.error?.code
  if (status === 401) throw createError({ statusCode: 401, statusMessage: 'Clé OpenAI refusée : vérifie-la ou crées-en une nouvelle' })
  if (code === 'insufficient_quota') throw createError({ statusCode: 402, statusMessage: 'Plus de crédit sur ton compte OpenAI (platform.openai.com → Billing)' })
  if (status === 429) throw createError({ statusCode: 429, statusMessage: 'OpenAI limite les demandes, réessaie dans un instant' })
  throw createError({ statusCode: 502, statusMessage: `OpenAI ne répond pas comme prévu${body?.error?.message ? ` : ${body.error.message.slice(0, 120)}` : ''}` })
}

/** Vérifie la clé et choisit le modèle. */
export async function checkOpenAiKey(key: string) {
  const res = await call(`${API}/models`, { headers: { Authorization: `Bearer ${key}` } })
  const body = await res.json().catch(() => undefined)
  if (!res.ok) apiError(res.status, body)
  const ids = new Set(((body?.data ?? []) as { id: string }[]).map((m) => m.id))
  const model = PREFERRED.find((m) => ids.has(m))
  if (!model) throw createError({ statusCode: 422, statusMessage: 'Cette clé n’a accès à aucun modèle adapté (projet OpenAI restreint ?)' })
  return model
}

export async function openAiJson<T>(
  event: H3Event,
  opts: { name: string; schema: Record<string, unknown>; instructions: string; input: string },
): Promise<T> {
  const session = await openaiSession(event)
  const { key, model } = session.data
  if (!key || !model) throw createError({ statusCode: 401, statusMessage: 'Ajoute d’abord ta clé OpenAI dans les réglages' })

  const res = await call(`${API}/responses`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      store: false,
      instructions: opts.instructions,
      input: opts.input,
      text: { format: { type: 'json_schema', name: opts.name, schema: opts.schema, strict: true } },
    }),
  })
  const body = await res.json().catch(() => undefined)
  if (!res.ok) {
    // Clé révoquée : on l'oublie pour que l'appli redemande une clé
    if (res.status === 401) await session.clear()
    apiError(res.status, body)
  }
  const text = (body?.output ?? [])
    .flatMap((o: { type: string; content?: { type: string; text?: string }[] }) => (o.type === 'message' ? (o.content ?? []) : []))
    .find((c: { type: string; text?: string }) => c.type === 'output_text')?.text
  if (!text) throw createError({ statusCode: 502, statusMessage: 'OpenAI n’a pas renvoyé de réponse' })
  return JSON.parse(text) as T
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
