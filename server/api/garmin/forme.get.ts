/*
 * Forme vue par Garmin (API non officielle) : VO2max, statut d'entraînement, charge,
 * préparation du jour, récupération et temps prédits en course.
 * Chaque donnée est indépendante : si l'une manque (montre qui ne la calcule pas,
 * réponse changée), les autres s'affichent quand même.
 */
const API = 'https://connectapi.garmin.com/metrics-service/metrics'

/** Première valeur trouvée sous ce nom, où qu'elle soit dans la réponse. */
function find(obj: unknown, key: string, depth = 0): unknown {
  if (!obj || typeof obj !== 'object' || depth > 8) return undefined
  if (!Array.isArray(obj) && key in (obj as Record<string, unknown>)) {
    const v = (obj as Record<string, unknown>)[key]
    if (v !== null && v !== undefined) return v
  }
  for (const v of Object.values(obj as Record<string, unknown>)) {
    const hit = find(v, key, depth + 1)
    if (hit !== undefined) return hit
  }
  return undefined
}
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)

const STATUS: [RegExp, string, 'ok' | 'warn' | 'ko' | 'idle'][] = [
  [/^PRODUCTIVE/, 'Productif', 'ok'],
  [/^PEAKING/, 'Pic de forme', 'ok'],
  [/^MAINTAINING/, 'Maintien', 'idle'],
  [/^RECOVERY/, 'Récupération', 'idle'],
  [/^UNPRODUCTIVE/, 'Non productif', 'warn'],
  [/^DETRAINING/, 'Désentraînement', 'warn'],
  [/^OVERREACHING/, 'Surmenage', 'ko'],
  [/^STRAINED/, 'Sous tension', 'ko'],
]

function today() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Brussels' }).format(new Date())
}

export default defineEventHandler(async (event) => {
  const gc = await garminClient(event)
  const date = today()
  const profile = await garminCall(() => gc.getUserProfile() as Promise<{ displayName?: string }>)
  const name = encodeURIComponent(profile.displayName ?? '')
  const get = (path: string) =>
    gc.get<unknown>(`${API}${path}`).catch((e: Error) => {
      console.warn('[garmin] forme', path.split('/')[1], e.message?.slice(0, 80))
      return undefined
    })

  const [status, readiness, predictions] = await Promise.all([
    get(`/trainingstatus/aggregated/${date}`),
    get(`/trainingreadiness/${date}`),
    name ? get(`/racepredictions/latest/${name}`) : undefined,
  ])

  const phrase = String(find(status, 'trainingStatusFeedbackPhrase') ?? '')
  const st = STATUS.find(([re]) => re.test(phrase))
  const acute = num(find(status, 'dailyTrainingLoadAcute'))
  const chronic = num(find(status, 'dailyTrainingLoadChronic'))

  // Prédictions : un objet { time5K, … } ou une liste { distance, time }
  const list = Array.isArray(predictions) ? (predictions as { distance?: number; time?: number }[]) : []
  const byDistance = (m: number) => num(list.find((p) => Math.abs((p.distance ?? 0) - m) < 100)?.time)
  const pred = {
    '5k': num(find(predictions, 'time5K')) ?? byDistance(5000),
    '10k': num(find(predictions, 'time10K')) ?? byDistance(10000),
    half: num(find(predictions, 'timeHalfMarathon')) ?? byDistance(21097.5),
    marathon: num(find(predictions, 'timeMarathon')) ?? byDistance(42195),
  }

  const last = Array.isArray(readiness) ? readiness[readiness.length - 1] : readiness
  const recoveryMin = num(find(last, 'recoveryTime'))

  return {
    vo2max: num(find(status, 'vo2MaxPreciseValue')) ?? num(find(status, 'vo2MaxValue')),
    status: st ? { label: st[1], tone: st[2] } : null,
    load: acute !== null ? { acute: Math.round(acute), chronic: chronic !== null ? Math.round(chronic) : null, ratio: num(find(status, 'dailyAcuteChronicWorkloadRatio')) } : null,
    readiness: num(find(last, 'score')) !== null ? { score: Math.round(num(find(last, 'score'))!), level: String(find(last, 'level') ?? '') } : null,
    // Garmin donne la récupération en minutes
    recoveryHours: recoveryMin !== null ? Math.round(recoveryMin / 60) : null,
    predictions: Object.values(pred).some((v) => v !== null) ? pred : null,
  }
})
