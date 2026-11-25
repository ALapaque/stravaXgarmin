/*
 * Zones de fréquence cardiaque.
 * Une zone commence à un seuil : les zones 2 à 5 ont chacune le leur, la zone 1 est tout ce qui est en dessous.
 * Deux découpages différents classent la même course dans des zones différentes : l'appli n'invente donc pas
 * le sien quand elle peut lire celui du coureur. Dans l'ordre :
 *   1. les zones de sa montre Garmin (celles qu'elle annonce pendant la course), quand Garmin est connecté ;
 *   2. celles de son compte Strava ;
 *   3. à défaut, ou s'il le préfère, un calcul sur sa FC max (50–60–70–80–90–100 %).
 * Logique pure, testée (tests/zones.test.ts). Les lectures elles-mêmes : useZones() côté navigateur.
 */

export type Zone = 1 | 2 | 3 | 4 | 5

/** Qui peut donner des zones toutes faites. */
export type ZoneProvider = 'garmin' | 'strava'
/** D'où viennent les zones : la montre, le compte Strava, ou un calcul sur la FC max. */
export type ZoneSource = ZoneProvider | 'fcmax'
/** Réglage du coureur. « auto » : la montre si Garmin est connecté, sinon Strava. */
export type ZoneChoice = 'auto' | ZoneSource
/**
 * Quelles zones pour une course courue avant un changement de réglage : celles d'aujourd'hui (défaut,
 * pour comparer toutes les courses avec la même règle) ou celles du jour de la course (ce que Garmin
 * Connect garde affiché : il ne recalcule jamais une activité).
 */
export type ZoneView = 'current' | 'day'

/** Jeu de zones : seuils d'entrée des zones 2, 3, 4 et 5 (bpm), et bornes à afficher quand elles existent. */
export interface ZoneSet {
  floors: number[]
  /** Bas de la zone 1 à afficher ; null : elle part de 0 */
  low: number | null
  /** Haut de la zone 5 à afficher (la FC max) ; null : pas de haut */
  top: number | null
}

export interface HrZone {
  z: Zone
  /** Première et dernière fréquence de la zone, comprises ; « to » null : la zone 5 n'a pas de haut */
  from: number
  to: number | null
  label: string
}

/** Zones d'une course telles que la montre ou Strava les donnent : les seuils et, s'il a été compté, le temps par zone. */
export interface RunZones {
  floors: number[]
  /** Bas de la zone 1 (Garmin en donne un) ; null : elle part de 0 */
  low: number | null
  /** Secondes par zone comptées à la source (index 0 = zone 1) ; null : à compter sur la courbe */
  sec: number[] | null
  /** Zones réglées à la main dans Strava (sinon : celles que Strava déduit de la FC max du compte) */
  custom: boolean
}

/** Sur quoi la montre appuie ses zones : FC max, FC de réserve, ou FC au seuil lactique. */
export type WatchMethod = 'max' | 'reserve' | 'lthr'

/** Zones réglées sur la montre (profil course à pied, sinon profil général). */
export interface WatchZones extends ZoneSet {
  method: WatchMethod | null
}

/** Réponse de GET /api/strava/zones/[id]. « available » faux : Strava réserve cette lecture à ses abonnés. */
export interface StravaZonesReply {
  available: boolean
  zones: RunZones | null
}

/** Réponse de GET /api/garmin/zones (zones réglées sur la montre). */
export interface WatchZonesReply {
  zones: WatchZones | null
}

/** Réponse de GET /api/garmin/zones/[id] (zones et temps par zone d'une activité Garmin). */
export interface WatchRunZonesReply {
  zones: RunZones | null
}

/** Dernières zones connues d'un compte (réglages, et courses dont les zones n'ont pas pu être lues). */
export interface AccountZones {
  /** Dernière lecture des zones du compte lui-même ; vide si elles viennent d'une course */
  at: string
  /** Première lecture de ces réglages-là dans le compte : une course courue ensuite doit porter les mêmes zones */
  since?: string
  /** Début de la course qui a donné ces seuils (vide : lus dans le compte) : une course plus ancienne ne les remplace pas */
  runAt: string
  floors: number[] | null
  low: number | null
  top: number | null
  custom: boolean
  /** Strava a répondu que cette lecture est réservée à ses abonnés */
  off: boolean
  method: WatchMethod | null
}

/** Zones à afficher, et d'où elles viennent. */
export interface ZonePick {
  set: ZoneSet | null
  /** Temps par zone compté à la source pour cette course ; null : à compter sur la courbe */
  sec: number[] | null
  /** La montre, le compte Strava, la FC max saisie, ou la FC max la plus haute vue ; null : rien à calculer */
  from: ZoneProvider | 'set' | 'seen' | null
  /** FC max utilisée quand les zones sont calculées */
  maxHr: number | null
  /** La source voulue (le réglage, une fois « auto » résolu) */
  wanted: ZoneSource
  /**
   * Pourquoi la source voulue n'a pas servi : Garmin n'est pas connecté (« unlinked »), Strava réserve
   * ses zones à ses abonnés (« off »), ou la lecture n'a pas (encore) abouti (« wait »).
   */
  why: 'unlinked' | 'off' | 'wait' | null
  /** Les zones de la source ont changé depuis cette course : on peut la voir avec les deux jeux */
  changed: boolean
  /** Le jeu affiché ; toujours « current » quand rien n'a changé */
  view: ZoneView
}

const LABELS = ['Très facile', 'Endurance', 'Tempo', 'Seuil', 'Maximum'] as const
/** Les noms que Garmin Connect donne à ses zones : quand les zones viennent de la montre, l'appli parle comme elle */
const WATCH_LABELS = ['Échauffement', 'Facile', 'Aérobie', 'Seuil', 'Maximum'] as const

const HR_LOW = 40
const HR_HIGH = 250

const isObj = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === 'object' && !Array.isArray(v)
const fin = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)

/** Quatre seuils entiers, strictement croissants et plausibles ; sinon null. */
export function validFloors(v: unknown): number[] | null {
  if (!Array.isArray(v) || v.length !== 4) return null
  const f = v.map((x) => (typeof x === 'number' && Number.isFinite(x) ? Math.round(x) : Number.NaN))
  for (let i = 0; i < 4; i++) {
    const x = f[i]!
    if (!(x >= HR_LOW && x <= HR_HIGH)) return null
    if (i > 0 && !(x > f[i - 1]!)) return null
  }
  return f
}

/** Bas de zone 1 gardé seulement s'il est sous le premier seuil ; sinon null. */
const lowOf = (low: unknown, floors: number[]): number | null => {
  const v = fin(low)
  return v !== null && v > 0 && v < floors[0]! ? Math.round(v) : null
}

/** Haut de zone 5 gardé seulement s'il est au-dessus du dernier seuil ; sinon null. */
const topOf = (top: unknown, floors: number[]): number | null => {
  const v = fin(top)
  return v !== null && v >= floors[3]! && v <= HR_HIGH ? Math.round(v) : null
}

/** Zones calculées depuis la FC max : 50–60–70–80–90–100 %. */
export function maxHrZones(maxHr: number): ZoneSet {
  return {
    floors: [0.6, 0.7, 0.8, 0.9].map((p) => Math.round(maxHr * p)),
    low: Math.round(maxHr * 0.5),
    top: Math.round(maxHr),
  }
}

/**
 * Seuils que Strava déduit d'une FC max quand le coureur n'a rien réglé (environ 65, 81, 89 et 97 %).
 * Sert seulement aux données de démo : pour un vrai compte, les seuils sont lus chez Strava.
 */
export function stravaDefaultFloors(maxHr: number): number[] {
  return [0.65, 0.81, 0.89, 0.97].map((p) => Math.round(maxHr * p))
}

/**
 * Zones d'une montre réglée « en % de la FC de réserve » (50, 60, 70, 80 et 90 % entre le repos et le max).
 * Sert seulement aux données de démo : pour un vrai compte, les zones sont lues chez Garmin.
 */
export function reserveZones(maxHr: number, restHr: number): WatchZones {
  const at = (p: number) => Math.round(restHr + (maxHr - restHr) * p)
  return { floors: [0.6, 0.7, 0.8, 0.9].map(at), low: at(0.5), top: Math.round(maxHr), method: 'reserve' }
}

/**
 * Les 5 zones d'un jeu, avec leurs bornes comprises (« 124–153 » : de 124 à 153 inclus).
 * « from » : d'où viennent les zones ; celles de la montre portent les noms de Garmin.
 */
export function hrZones(set: ZoneSet, from?: ZonePick['from']): HrZone[] {
  const f = set.floors
  // Un bas ou un haut incohérent avec les seuils n'est pas affiché
  const low = lowOf(set.low, f) ?? 0
  const top = topOf(set.top, f)
  return (from === 'garmin' ? WATCH_LABELS : LABELS).map((label, i) => ({
    z: (i + 1) as Zone,
    from: i === 0 ? low : f[i - 1]!,
    to: i === 4 ? top : f[i]! - 1,
    label,
  }))
}

/** Plage d'une zone à l'écran : « 124–153 », et « 184+ » pour une zone 5 sans haut. */
export function zoneRange(z: Pick<HrZone, 'from' | 'to'>): string {
  return z.to === null ? `${z.from}+` : `${z.from}–${z.to}`
}

/** Zone d'une fréquence cardiaque : la plus haute dont le seuil est atteint ; sous le premier seuil, zone 1. */
export function zoneOf(hr: number, floors: number[]): Zone {
  let z = 1
  while (z < 5 && hr >= floors[z - 1]!) z++
  return z as Zone
}

/**
 * Secondes passées dans chaque zone (index 0 = zone 1) ; null sans cardio ou sans seuils.
 * « low » : bas de la zone 1 quand la source en a un (la montre). Le temps passé dessous n'est alors
 * compté dans aucune zone, comme le fait Garmin ; sans « low », il est compté en zone 1.
 */
export function timeInZones(
  stream: { t: number[]; hr: number[] | null } | null | undefined,
  floors: number[] | null | undefined,
  low: number | null = null,
): number[] | null {
  if (!stream?.hr?.length || !Array.isArray(stream.t) || !floors || floors.length !== 4) return null
  const out = [0, 0, 0, 0, 0]
  let any = false
  for (let i = 1; i < stream.t.length && i < stream.hr.length; i++) {
    const dt = stream.t[i]! - stream.t[i - 1]!
    const hr = stream.hr[i]!
    if (!(dt > 0) || !(hr > 0)) continue
    any = true
    if (low !== null && hr < low) continue
    out[zoneOf(hr, floors) - 1]! += dt
  }
  return any ? out.map((s) => Math.round(s)) : null
}

/** FC max estimée : la plus haute vue ; null s'il y a moins de 3 courses avec cardio. */
export function estimateHrMax(runs: { maxHr?: number | null }[]): number | null {
  const seen = runs.map((r) => r.maxHr ?? 0).filter((v) => v > 0)
  return seen.length >= 3 ? Math.max(...seen) : null
}

/* ───── Lecture des réponses de Strava et de Garmin ───── */

/**
 * Zones cardio d'une course dans la réponse de Strava (GET /activities/{id}/zones) : une liste dont l'entrée
 * « heartrate » porte cinq tranches { min, max, time }. Le seuil d'une zone est le « min » de sa tranche
 * (le « max » de la dernière vaut -1 : on ne le lit pas). Lecture défensive : autre chose que cinq tranches
 * aux seuils croissants, et on ne retient rien (l'appli prend alors une autre source).
 */
export function stravaHrZones(raw: unknown): RunZones | null {
  const entry = (Array.isArray(raw) ? raw : []).find((z) => isObj(z) && z.type === 'heartrate')
  if (!isObj(entry) || !Array.isArray(entry.distribution_buckets)) return null
  const buckets = entry.distribution_buckets
    .filter(isObj)
    .map((b) => ({ min: fin(b.min), time: fin(b.time) }))
    .filter((b): b is { min: number; time: number | null } => b.min !== null)
    .sort((a, b) => a.min - b.min)
  if (buckets.length !== 5) return null
  const floors = validFloors(buckets.slice(1).map((b) => b.min))
  if (!floors) return null
  const sec = buckets.map((b) => Math.max(0, Math.round(b.time ?? 0)))
  return { floors, low: null, sec: sec.some((s) => s > 0) ? sec : null, custom: entry.custom_zones === true }
}

const METHODS: Record<string, WatchMethod> = { HR_MAX: 'max', HR_RESERVE: 'reserve', LACTATE_THRESHOLD: 'lthr' }

/**
 * Zones réglées sur la montre, dans la réponse de Garmin Connect (GET /biometric-service/heartRateZones) :
 * une entrée par profil de sport, avec « zone1Floor » … « zone5Floor », « maxHeartRateUsed » et
 * « trainingMethod ». On prend le profil course à pied (« RUNNING »), sinon le profil général (« DEFAULT »),
 * sinon le premier lisible. API non officielle : lecture défensive, rien n'est retenu si les seuils ne tiennent pas debout.
 */
export function garminAccountZones(raw: unknown): WatchZones | null {
  const list = (Array.isArray(raw) ? raw : isObj(raw) ? [raw] : []).filter(isObj)
  const read = (o: Record<string, unknown>): WatchZones | null => {
    const floors = validFloors([o.zone2Floor, o.zone3Floor, o.zone4Floor, o.zone5Floor])
    if (!floors) return null
    return { floors, low: lowOf(o.zone1Floor, floors), top: topOf(o.maxHeartRateUsed, floors), method: METHODS[String(o.trainingMethod ?? '')] ?? null }
  }
  const sport = (name: string) => list.find((o) => String(o.sport ?? '').toUpperCase() === name)
  for (const o of [sport('RUNNING'), sport('DEFAULT'), ...list]) {
    const zones = o ? read(o) : null
    if (zones) return zones
  }
  return null
}

/**
 * Zones et temps par zone d'une activité Garmin (GET /activity-service/activity/{id}/hrTimeInZones) : cinq
 * lignes { zoneNumber, zoneLowBoundary, secsInZone }. Ce sont les zones de la montre au moment de la course,
 * et le temps qu'elle a compté elle-même. API non officielle : lecture défensive, comme ci-dessus.
 */
export function garminRunZones(raw: unknown): RunZones | null {
  const rows = (Array.isArray(raw) ? raw : [])
    .filter(isObj)
    .map((o) => ({ z: fin(o.zoneNumber), low: fin(o.zoneLowBoundary), sec: fin(o.secsInZone) }))
    .filter((r): r is { z: number; low: number; sec: number | null } => r.z !== null && r.low !== null)
    .sort((a, b) => a.z - b.z)
  if (rows.length !== 5 || rows.some((r, i) => r.z !== i + 1)) return null
  const floors = validFloors(rows.slice(1).map((r) => r.low))
  if (!floors) return null
  const sec = rows.map((r) => Math.max(0, Math.round(r.sec ?? 0)))
  return { floors, low: lowOf(rows[0]!.low, floors), sec: sec.some((s) => s > 0) ? sec : null, custom: false }
}

/* ───── Choix des zones à afficher ───── */

type KnownZones = Pick<AccountZones, 'floors'> &
  Partial<Pick<AccountZones, 'low' | 'top' | 'off'>> & {
    /**
     * Ces zones sont les réglages d'aujourd'hui, lus dans le compte et non déduits d'une course : on peut
     * relire une ancienne course avec. Vrai seulement pour la montre (Strava ne donne ses zones qu'avec une course).
     */
    live?: boolean
  }

/**
 * Mêmes zones, au battement près : l'arrondi d'un seuil peut différer entre les réglages de la montre et
 * une activité, et un seul battement d'écart ne change rien à la lecture d'une course. Le bas de la zone 1
 * n'est comparé que si les deux en ont un.
 */
export function sameZones(a: Pick<ZoneSet, 'floors' | 'low'>, b: Pick<ZoneSet, 'floors' | 'low'>): boolean {
  const near = (x: number, y: number | undefined) => y !== undefined && Math.abs(x - y) <= 1
  if (a.floors.length !== b.floors.length || a.floors.some((f, i) => !near(f, b.floors[i]))) return false
  return a.low === null || b.low === null || near(a.low, b.low)
}

/**
 * Les zones lues dans les réglages de la montre sont-elles bien celles qu'elle applique ? L'API de Garmin
 * ne se vérifie pas depuis l'atelier, alors la course la plus récente fait foi : courue après que l'appli
 * a lu ces réglages (« since »), elle doit porter les mêmes zones. Sinon la lecture ne dit pas ce que fait
 * la montre (autre profil de sport, réglage pas encore arrivé sur la montre) : rien n'est relu avec.
 */
export function watchZonesHold(
  account: Pick<ZoneSet, 'floors' | 'low'> & { since: string },
  newest: { startedAt: string; zones: Pick<ZoneSet, 'floors' | 'low'> } | null,
): boolean {
  if (!newest) return true
  const ran = Date.parse(newest.startedAt)
  const read = Date.parse(account.since)
  if (!Number.isFinite(ran) || !Number.isFinite(read) || ran <= read) return true
  return sameZones(newest.zones, account)
}

/**
 * Choix des zones à afficher. Source « garmin » : la montre, sinon le compte Strava ; source « strava » :
 * le compte Strava ; puis, faute de mieux (ou source « fcmax »), le calcul sur la FC max, en disant pourquoi.
 * Pour chaque source : les zones lues avec la course, sinon les dernières connues du compte.
 * Si les réglages d'aujourd'hui de la source voulue (compte « live ») ne sont plus ceux de la course,
 * ils sont pris par défaut (temps à recompter sur la courbe), ceux du jour à la demande (« view »).
 * FC max : celle saisie par le coureur, sinon la plus haute vue sur ses courses.
 */
export function pickZones(i: {
  source: ZoneSource
  /** Garmin est-il connecté ? (pour dire pourquoi la montre n'a pas servi) */
  garminOn?: boolean
  /** Pour une course dont les zones ont changé depuis : celles d'aujourd'hui (défaut) ou celles du jour */
  view?: ZoneView
  /** Zones demandées pour une course : la zone 5 n'a alors pas de haut, comme dans Garmin Connect */
  forRun?: boolean
  runs?: Partial<Record<ZoneProvider, RunZones | null>> | null
  accounts?: Partial<Record<ZoneProvider, KnownZones | null>> | null
  hrMax: number | null | undefined
  estimated: number | null | undefined
}): ZonePick {
  const wanted = i.source
  const why: ZonePick['why'] =
    wanted === 'garmin' ? (i.garminOn === false ? 'unlinked' : 'wait') : wanted === 'strava' ? (i.accounts?.strava?.off ? 'off' : 'wait') : null
  const chain: ZoneProvider[] = wanted === 'garmin' ? ['garmin', 'strava'] : wanted === 'strava' ? ['strava'] : []
  for (const p of chain) {
    const base = { from: p, maxHr: null, wanted, why: p === wanted ? null : why, changed: false, view: 'current' as ZoneView }
    const run = i.runs?.[p]
    const own = validFloors(run?.floors)
    const day = own ? { floors: own, low: lowOf(run!.low, own), top: null } : null
    const daySec = own && Array.isArray(run!.sec) && run!.sec.length === 5 ? run!.sec : null
    const account = i.accounts?.[p]
    const known = validFloors(account?.floors)
    const now = known ? { floors: known, low: lowOf(account!.low, known), top: i.forRun ? null : topOf(account!.top, known) } : null
    // Les zones de la source voulue ont changé depuis cette course : deux lectures possibles
    if (day && now && p === wanted && account!.live && !sameZones(day, now)) {
      return i.view === 'day' ? { ...base, set: day, sec: daySec, changed: true, view: 'day' } : { ...base, set: now, sec: null, changed: true }
    }
    if (day) return { ...base, set: day, sec: daySec }
    if (now) return { ...base, set: now, sec: null }
  }
  const typed = i.hrMax && i.hrMax > 0 ? i.hrMax : null
  const maxHr = typed ?? (i.estimated && i.estimated > 0 ? i.estimated : null)
  return { set: maxHr ? maxHrZones(maxHr) : null, sec: null, from: typed ? 'set' : maxHr ? 'seen' : null, maxHr, wanted, why, changed: false, view: 'current' }
}

/** Sous le cardio d'une course : d'où viennent les zones affichées, et pourquoi si ce ne sont pas celles voulues. */
export function zoneNote(p: ZonePick): string {
  if (p.changed && p.view === 'current') return 'Tes zones ont changé depuis cette course : elle est relue avec celles d’aujourd’hui, et le temps est recompté sur ta courbe.'
  if (p.changed && p.from === 'garmin') return 'Ce sont les zones que ta montre avait ce jour-là, comme dans Garmin Connect.'
  if (p.from === 'garmin') return 'Ce sont les zones de ta montre Garmin.'
  const missing =
    p.wanted === 'garmin'
      ? p.why === 'unlinked'
        ? 'Garmin n’est pas connecté'
        : 'Les zones de ta montre n’ont pas pu être lues'
      : p.wanted === 'strava'
        ? p.why === 'off'
          ? 'Strava ne donne tes zones qu’à ses abonnés'
          : 'Tes zones Strava n’ont pas pu être lues'
        : null
  if (p.from === 'strava') return p.wanted === 'strava' ? 'Ce sont les zones de ton compte Strava.' : `${missing} : ce sont celles de ton compte Strava.`
  if (!p.maxHr) return 'Il faut au moins trois courses avec cardio pour calculer tes zones.'
  const max = `sur une FC max de ${p.maxHr} bpm (${p.from === 'set' ? 'celle que tu as saisie' : 'la plus haute vue sur tes courses'}).`
  return missing ? `${missing} : tes zones sont calculées ${max}` : `Zones calculées ${max}`
}

const METHOD_TEXT: Record<WatchMethod, string> = {
  max: 'en % de ta FC max',
  reserve: 'en % de ta FC de réserve',
  lthr: 'en % de ta FC au seuil lactique',
}

/** Dans les réglages, sous le choix de la source : ce que sont les zones affichées, et comment les changer. */
export function zoneSourceLine(p: ZonePick, o: { reading?: boolean; method?: WatchMethod | null; custom?: boolean } = {}): string {
  if (p.from === 'garmin') {
    return `Ce sont les zones de ta montre Garmin${o.method ? `, réglées ${METHOD_TEXT[o.method]}` : ''}. Pour les changer, c’est sur ta montre ou dans Garmin Connect.`
  }
  if (p.wanted === 'fcmax') return 'De 50 à 100 % de ta FC max, par tranches de 10 % : le découpage par défaut de la plupart des montres.'
  if (p.wanted === 'strava' && p.from === 'strava') {
    return `Ce sont les zones de ton compte Strava${o.custom ? ', réglées par toi' : ''}. Pour les changer, c’est dans les réglages de Strava.`
  }
  const head =
    p.wanted === 'garmin'
      ? p.why === 'unlinked'
        ? 'Connecte Garmin pour lire les zones de ta montre.'
        : o.reading
          ? 'Lecture des zones de ta montre…'
          : 'Les zones de ta montre n’ont pas pu être lues.'
      : o.reading
        ? 'Lecture de tes zones Strava…'
        : p.why === 'off'
          ? 'Strava ne donne tes zones qu’à ses abonnés.'
          : 'Tes zones Strava seront lues à l’ouverture d’une course.'
  const then = p.from === 'strava' ? ' En attendant, voici celles de ton compte Strava.' : p.set ? ' En attendant, elles sont calculées sur ta FC max.' : ''
  return `${head}${then}`
}
