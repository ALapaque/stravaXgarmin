/*
 * État des connexions : ce que l'appli a réussi à lire chez Strava, Garmin et l'IA, et quand.
 * Partie pure (testée dans tests/health.test.ts) ; l'état vit dans useHealth() côté navigateur.
 */

export type HealthKey =
  | 'strava.activities'
  | 'strava.details'
  | 'strava.gear'
  | 'strava.streams'
  | 'garmin.activities'
  | 'garmin.plan'
  | 'garmin.forme'
  | 'garmin.records'
  | 'ai'

export type HealthProvider = 'strava' | 'garmin' | 'ai'

export interface HealthEntry {
  status: 'idle' | 'ok' | 'error'
  /** Dernier essai */
  at: string | null
  /** Dernière réussite (gardée quand un essai suivant échoue) */
  okAt: string | null
  /** Message lisible (celui du serveur quand il y en a un) */
  error: string | null
  /** Code HTTP de l'erreur */
  code: number | null
  /** Ce qui a été lu : « 16 courses », « 2 paires »… */
  info: string | null
}

export type Health = Record<HealthKey, HealthEntry>

export const HEALTH_SOURCES: { key: HealthKey; provider: HealthProvider; label: string; hint: string }[] = [
  { key: 'strava.activities', provider: 'strava', label: 'Tes courses', hint: 'Tes courses des 60 derniers jours' },
  { key: 'strava.details', provider: 'strava', label: 'Détail des courses', hint: 'Temps au kilomètre et meilleurs efforts' },
  { key: 'strava.gear', provider: 'strava', label: 'Chaussures', hint: 'Tes paires et leur kilométrage' },
  { key: 'strava.streams', provider: 'strava', label: 'Fréquence cardiaque et allure', hint: 'Courbes de la dernière course ouverte' },
  { key: 'garmin.activities', provider: 'garmin', label: 'Noms donnés par ta montre', hint: 'Le nom de chaque activité' },
  { key: 'garmin.plan', provider: 'garmin', label: 'Séances prévues', hint: 'Ton calendrier d’entraînement' },
  { key: 'garmin.forme', provider: 'garmin', label: 'Forme du jour', hint: 'VO2max, charge, préparation du jour' },
  { key: 'garmin.records', provider: 'garmin', label: 'Records', hint: 'Tes records de tous les temps' },
  { key: 'ai', provider: 'ai', label: 'Titres et analyses', hint: 'Demandes faites à l’IA' },
]

export const HEALTH_KEYS = HEALTH_SOURCES.map((s) => s.key)

export const emptyEntry = (): HealthEntry => ({ status: 'idle', at: null, okAt: null, error: null, code: null, info: null })

export function emptyHealth(): Health {
  return Object.fromEntries(HEALTH_KEYS.map((k) => [k, emptyEntry()])) as Health
}

/** Lecture réussie ; « info » remplace l'ancienne quand elle est donnée. */
export function markOk(entry: HealthEntry | undefined, nowIso: string, info?: string | null): HealthEntry {
  const e = entry ?? emptyEntry()
  return { status: 'ok', at: nowIso, okAt: nowIso, error: null, code: null, info: info ?? e.info }
}

/** Lecture en échec : la dernière réussite et ce qui avait été lu restent connus. */
export function markError(entry: HealthEntry | undefined, nowIso: string, message: string, code?: number | null): HealthEntry {
  const e = entry ?? emptyEntry()
  return { status: 'error', at: nowIso, okAt: e.okAt, error: message, code: code ?? null, info: e.info }
}

export interface Connected {
  strava: boolean
  garmin: boolean
  ai: boolean
}

/**
 * Résumé pour l'écran et les alertes. Les sources d'un compte non connecté sont ignorées.
 * « core » : la lecture principale en échec (Strava d'abord, puis les noms Garmin), sinon null.
 */
export function healthSummary(health: Partial<Health>, connected: Connected) {
  const errors: HealthKey[] = []
  let lastAt: string | null = null
  for (const s of HEALTH_SOURCES) {
    if (!connected[s.provider]) continue
    const e = health[s.key]
    if (!e) continue
    if (e.status === 'error') errors.push(s.key)
    if (e.at && (!lastAt || Date.parse(e.at) > Date.parse(lastAt))) lastAt = e.at
  }
  const core: HealthKey | null = errors.includes('strava.activities')
    ? 'strava.activities'
    : connected.garmin && errors.includes('garmin.activities')
      ? 'garmin.activities'
      : null
  return { errors, lastAt, core }
}

/* ───── Ce qui a été lu, en mots ───── */

const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`

export const HEALTH_INFO = {
  activities: (n: number) => `${plural(n, 'course', 'courses')} sur les 60 derniers jours`,
  details: (got: number, asked: number) =>
    got < asked
      ? `${got} ${asked > 1 ? 'courses' : 'course'} sur ${asked}, la suite à la prochaine lecture`
      : `Temps au kilomètre et meilleurs efforts de ${plural(got, 'course', 'courses')}`,
  gear: (n: number) => plural(n, 'paire', 'paires'),
  garminActivities: (n: number) => plural(n, 'activité', 'activités'),
  plan: (upcoming: number, past?: number) =>
    `${plural(upcoming, 'séance', 'séances')} à venir${past ? `, ${past} ${past > 1 ? 'passées' : 'passée'}` : ''}`,
  /** Courbes reçues pour la dernière course ouverte */
  streams: (s: { hr?: unknown; v?: unknown }) =>
    s.hr && s.v ? 'Cardio et allure' : s.hr ? 'Cardio seulement' : s.v ? 'Allure seulement' : 'Aucune courbe pour cette course',
  records: (n: number) => plural(n, 'record', 'records'),
  ai: () => 'Dernière demande réussie',
  /** Données de forme reçues, puis celles qui manquent */
  forme: (f: {
    vo2max?: unknown
    status?: unknown
    load?: unknown
    predictions?: unknown
    readiness?: unknown
    recoveryHours?: unknown
  }) => {
    const parts: [string, unknown][] = [
      ['VO2max', f.vo2max],
      ['statut', f.status],
      ['charge', f.load],
      ['prédictions', f.predictions],
      ['préparation du jour', f.readiness],
      ['récupération', f.recoveryHours],
    ]
    const got = parts.filter(([, v]) => v !== null && v !== undefined).map(([l]) => l)
    const missing = parts.filter(([, v]) => v === null || v === undefined).map(([l]) => l)
    if (!got.length) return 'Aucune donnée reçue'
    const list = got.join(', ')
    return `${list.charAt(0).toUpperCase()}${list.slice(1)}${missing.length ? `. Sans : ${missing.join(', ')}` : ''}`
  },
}

/* ───── Diagnostic à copier ───── */

/** Adresses e-mail et URL remplacées : le diagnostic ne doit rien contenir de personnel. */
export function maskPrivate(text: string): string {
  return text
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '[masqué]')
    .replace(/\b(?:https?:\/\/|www\.)\S+/gi, '[masqué]')
}

const STATUS_WORDS: Record<HealthEntry['status'], string> = { idle: 'pas encore lu', ok: 'ok', error: 'échec' }

/**
 * Texte à coller dans un message d'aide : version, date, comptes connectés (oui/non), état de chaque lecture, navigateur.
 * Aucun nom, aucune course, aucun accès : seulement l'état de chaque lecture.
 */
export function diagnosticText(i: {
  version: string
  now: string
  connected: Connected
  aiProvider: string | null
  health: Partial<Health>
  userAgent: string
}): string {
  const yes = (b: boolean) => (b ? 'oui' : 'non')
  const lines = [
    'stravaXgarmin · diagnostic',
    `Version : ${i.version}`,
    `Date : ${i.now}`,
    `Strava : ${yes(i.connected.strava)} · Garmin : ${yes(i.connected.garmin)} · IA : ${yes(i.connected.ai)}${i.connected.ai && i.aiProvider ? ` (${maskPrivate(i.aiProvider)})` : ''}`,
    '',
  ]
  for (const s of HEALTH_SOURCES) {
    const e = i.health[s.key] ?? emptyEntry()
    if (!i.connected[s.provider]) {
      lines.push(`${s.key} : compte non connecté`)
      continue
    }
    let line = `${s.key} : ${STATUS_WORDS[e.status]} · essai ${e.at ?? 'jamais'} · réussite ${e.okAt ?? 'jamais'}`
    if (e.status === 'error') {
      const msg = maskPrivate(e.error ?? '').replace(/\s+/g, ' ').trim()
      line += ` · code ${e.code ?? '?'} · ${msg.length > 160 ? `${msg.slice(0, 159)}…` : msg}`
    }
    lines.push(line)
  }
  lines.push('', `Navigateur : ${maskPrivate(i.userAgent)}`)
  return lines.join('\n')
}
