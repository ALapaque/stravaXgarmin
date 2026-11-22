/*
 * Courses : état gardé dans le navigateur, et tout ce que l'appli écrit chez Strava ou Garmin
 * (avec trace dans l'historique et annulation). Données de démo : shared/utils/demo.ts.
 */

import { RUN_LABELS, type RunType } from '#shared/utils/runs'
import type { Activity } from '#shared/utils/model'
import { buildDemo, DEMO_SHOES, type DemoData } from '#shared/utils/demo'

// Ré-exporté ici pour ne pas casser les imports existants (« from '~/composables/useActivities' »)
export type { RunType }
/** Sorte de texte que l'appli place dans la description Strava : infos de la course, ou analyse IA */
export type BlockKind = 'infos' | 'analyse'

// Forme des données : shared/utils/model.ts (partagée avec la logique pure et la démo)
export type { Activity, ChangeSource, EffortKey, Shoe, Weather } from '#shared/utils/model'

/** Libellé (shared/utils/runs.ts) et couleur du thème de chaque type de séance. */
export const RUN_TYPES = Object.fromEntries(
  (Object.keys(RUN_LABELS) as RunType[]).map((t) => [t, { label: RUN_LABELS[t], color: `var(--type-${t})` }]),
) as Record<RunType, { label: string; color: string }>

export const SHOES = DEMO_SHOES

/** Date du jour à Bruxelles (AAAA-MM-JJ). Les données de démo sont datées par rapport à ce jour. */
export const TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Brussels' }).format(new Date())

/* ───── Démo : shared/utils/demo.ts, datée d'aujourd'hui ───── */

let demoCache: { day: string; data: DemoData } | null = null

/** Données de démo du jour, à lire seulement (ne pas modifier : elles servent de modèle). */
export function demoBase(): DemoData {
  if (demoCache?.day !== TODAY) demoCache = { day: TODAY, data: buildDemo(TODAY) }
  return demoCache.data
}

/** Copie des données de démo du jour, que l'état de l'appli peut modifier librement. */
export const demoData = (): DemoData => structuredClone(demoBase())

export const demoActivities = (): Activity[] => demoData().activities

/** Tampon de la démo gardée : version des données et jour où elles ont été produites. */
export const useDemoStamp = () => useState<{ version: number; day: string } | null>('demoStamp', () => null)

export function useActivities() {
  const activities = useState<Activity[]>('activities', () => (isDemoCookie() ? demoActivities() : []))

  const byId = (id: string) => activities.value.find((a) => a.id === id)
  /** Même nom sur Strava et sur la montre (sert seulement à la carte « Nom de l’activité ») */
  const isSynced = (a: Activity) => a.garminName === a.stravaName
  /*
   * « Nom à revoir » : seulement un nom Strava par défaut (« Morning Run », « Course à pied en soirée »…).
   * Un titre amélioré à la main n'est jamais à revoir, même s'il diffère du nom de la montre.
   */
  const needsReview = (a: Activity) => isGenericName(a.stravaName)
  const toReview = computed(() => activities.value.filter(needsReview))
  const sorted = computed(() => [...activities.value].sort((a, b) => b.startedAt.localeCompare(a.startedAt)))

  /** Les 7 derniers jours, aujourd'hui compris, pour l'histogramme de l'accueil. */
  const lastWeek = computed(() => {
    const days = lastDays(7)
    const runs = activities.value.filter((a) => days.some((d) => d.key === a.localDate))
    return {
      days: days.map((d) => ({
        ...d,
        km: runs.filter((a) => a.localDate === d.key).reduce((s, a) => s + a.distanceKm, 0),
      })),
      km: runs.reduce((s, a) => s + a.distanceKm, 0),
      sec: runs.reduce((s, a) => s + a.durationSec, 0),
      count: runs.length,
      // Courses dont le nom Strava n'est pas un nom par défaut
      synced: runs.filter((a) => !needsReview(a)).length,
    }
  })

  /** Change le nom sur Strava (et l'envoie à l'API en mode réel), avec trace pour annuler. */
  async function setStravaName(id: string, name: string, source: ChangeSource) {
    const a = byId(id)
    if (!a || a.stravaName === name) return true
    const before = a.stravaName
    a.stravaName = name
    if (!(await pushField(a, 'name', name))) {
      a.stravaName = before
      return false
    }
    useHistory().record({ activityId: id, field: 'name', before, after: name, source })
    return true
  }

  /*
   * Texte exact publié par l'appli dans chaque description, par course et par sorte.
   * Limite connue : ce souvenir vit dans ce navigateur. Depuis un autre appareil, un texte identique
   * n'est pas ajouté deux fois (il est retrouvé dans la description), mais un texte différent
   * (kilométrage des chaussures qui a bougé) sera ajouté à la suite au lieu de remplacer l'ancien.
   * Ce sera réglé avec le stockage partagé (dernière phase).
   */
  const published = usePublished()

  const remember = rememberBlock

  /** Le texte de l'appli de cette sorte est-il dans la description (telle que connue) ? */
  function isPublished(id: string, kind: BlockKind) {
    const block = published.value[id]?.[kind]
    if (!block) return false
    const a = byId(id)
    // Description pas encore relue (mode réel) : on se fie au souvenir
    return a?.stravaDescription === undefined ? true : hasBlock(a.stravaDescription, block)
  }

  /**
   * Ajoute (ou met à jour) le texte de l'appli dans la description Strava, sans toucher au reste.
   * Renvoie ce qui s'est passé, ou false en cas d'échec (message affiché).
   */
  async function publishBlock(id: string, kind: BlockKind, text: string, source: ChangeSource): Promise<MergeChange | false> {
    const a = byId(id)
    if (!a) return false
    const previous = published.value[id]?.[kind]
    const r = await sendBlock(a, text, previous)
    if (!r) return false
    a.stravaDescription = r.after
    if (r.change === 'added' || r.change === 'replaced') {
      // Bloc pas retrouvé après écriture (blancs retouchés au-delà du tolérable) : rien n'est mémorisé,
      // et l'historique garde le texte demandé
      remember(id, kind, r.block)
      useHistory().record({
        activityId: id,
        field: 'description',
        before: r.before,
        after: r.after,
        source,
        block: r.block || normalizeNewlines(text).trim(),
        previousBlock: r.change === 'replaced' ? normalizeNewlines(previous).trim() : '',
      })
    } else if (r.change === 'removed') {
      remember(id, kind, '')
    } else if (r.change === 'none' && hasBlock(r.after, text)) {
      // Déjà présent (ajouté depuis un autre appareil, par exemple) : on le reconnaît comme publié
      remember(id, kind, normalizeNewlines(text).trim())
    }
    return r.change
  }

  /** Relit la description réelle ; oublie les textes de l'appli qui n'y sont plus (retirés ou retouchés sur Strava). */
  async function refreshDescription(id: string) {
    const a = byId(id)
    if (!a?.stravaId) return true
    try {
      const res = await $fetch<{ description: string }>(`/api/strava/activities/${a.stravaId}`)
      a.stravaDescription = normalizeNewlines(res.description)
      for (const kind of Object.keys(published.value[id] ?? {}) as BlockKind[]) {
        if (!hasBlock(a.stravaDescription, published.value[id]?.[kind])) remember(id, kind, '')
      }
      return true
    } catch {
      return false
    }
  }

  /** Renomme l'activité dans Garmin Connect (option, API non officielle). */
  async function setGarminName(id: string, name: string, source: ChangeSource) {
    const a = byId(id)
    if (!a || a.garminName === name) return true
    const before = a.garminName
    a.garminName = name
    if (!(await pushField(a, 'garminName', name))) {
      a.garminName = before
      return false
    }
    useHistory().record({ activityId: id, field: 'garminName', before, after: name, source })
    return true
  }

  /*
   * Type choisi à la main (gardé dans le navigateur) : il gagne sur celui deviné par l'appli,
   * y compris aux synchros suivantes. « null » rend le type deviné.
   */
  const typeOverrides = useTypeOverrides()
  function setType(id: string, type: RunType | null) {
    const next = { ...typeOverrides.value }
    if (type) next[id] = type
    else delete next[id]
    typeOverrides.value = next
    const a = byId(id)
    if (!a) return
    if (!a.autoType) {
      a.autoType = a.type
      a.autoReason = a.typeReason
    }
    const r = withOverride({ type: a.autoType, reason: a.autoReason ?? '' }, type)
    a.type = r.type
    a.typeReason = r.reason || undefined
  }

  return { activities, sorted, byId, isSynced, needsReview, toReview, lastWeek, setStravaName, setGarminName, published, isPublished, publishBlock, refreshDescription, typeOverrides, setType }
}

/** Les n derniers jours jusqu'à TODAY inclus, du plus ancien au plus récent. */
export function lastDays(n: number) {
  const end = new Date(`${TODAY}T12:00:00Z`)
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(end)
    d.setUTCDate(end.getUTCDate() - (n - 1 - i))
    return {
      key: d.toISOString().slice(0, 10),
      letter: new Intl.DateTimeFormat('fr-BE', { weekday: 'narrow', timeZone: 'UTC' }).format(d),
    }
  })
}

/** Types choisis à la main, par course (gardés dans le navigateur). */
export const useTypeOverrides = () => useState<Record<string, RunType>>('typeOverrides', () => ({}))

/** Textes publiés par l'appli dans les descriptions Strava (gardés dans le navigateur). */
export const usePublished = () => useState<Record<string, Partial<Record<BlockKind, string>>>>('published', () => ({}))

/** Mémorise le texte publié pour cette course et cette sorte ('' : l'oublie). */
export function rememberBlock(id: string, kind: BlockKind, block: string) {
  const published = usePublished()
  const mine = { ...published.value[id] }
  if (block) mine[kind] = block
  else delete mine[kind]
  const next = { ...published.value }
  if (Object.keys(mine).length) next[id] = mine
  else delete next[id]
  published.value = next
}

/**
 * Envoie un nouveau nom à Strava ou Garmin quand l'activité vient des API.
 * En mode démo (pas d'identifiant), ne fait rien et réussit toujours.
 * La description ne passe jamais par ici : voir sendBlock (jamais de remplacement complet).
 */
export async function pushField(a: Activity, field: 'name' | 'garminName', value: string) {
  try {
    if (field === 'garminName') {
      if (!a.garminId) return true
      await $fetch(`/api/garmin/activities/${a.garminId}`, { method: 'PUT', body: { name: value } })
    } else {
      if (!a.stravaId) return true
      const res = await $fetch<{ name: string }>(`/api/strava/activities/${a.stravaId}`, { method: 'PUT', body: { name: value } })
      // Strava renvoie l'activité modifiée : on vérifie que le changement a bien été pris
      if (res.name.trim() !== value.trim()) {
        useToast().show('Strava n’a pas pris la modification, réessaie')
        return false
      }
    }
    return true
  } catch (e) {
    useToast().show(errorMessage(e) ?? (field === 'garminName' ? 'Garmin a refusé la modification' : 'Strava a refusé la modification'))
    return false
  }
}

const errorMessage = (e: unknown) => (e as { data?: { statusMessage?: string } }).data?.statusMessage

/**
 * Place « text » à la place de « previous » dans la description Strava (ou l'ajoute à la suite, ou le retire
 * si « text » est vide). Le serveur relit la description juste avant d'écrire ; en démo, la même fusion
 * est faite sur place. Renvoie la description avant/après et le texte réellement placé, ou null (message affiché).
 */
export async function sendBlock(a: Activity, text: string, previous?: string) {
  const prev = normalizeNewlines(previous).trim()
  if (!a.stravaId) {
    const before = normalizeNewlines(a.stravaDescription)
    const r = mergeDescription(before, text, prev)
    return { before, after: r.text, change: r.change, block: r.block }
  }
  try {
    const res = await $fetch<{ description: string; previousDescription: string; change: MergeChange }>(
      `/api/strava/activities/${a.stravaId}`,
      { method: 'PUT', body: { descriptionBlock: { text, previous: prev || undefined } } },
    )
    const before = normalizeNewlines(res.previousDescription)
    const after = normalizeNewlines(res.description)
    // Même fusion que le serveur, pour connaître le texte exact placé (raccourci s'il était trop long)
    let block = mergeDescription(before, text, prev).block
    if ((res.change === 'added' || res.change === 'replaced') && !hasBlock(after, block)) {
      // Description inchangée : Strava n'a rien pris, on peut réessayer
      if (after === before) {
        useToast().show('Strava n’a pas pris la modification, réessaie')
        return null
      }
      // Elle a changé mais le bloc n'y est pas retrouvé : le texte est écrit (réessayer créerait un doublon),
      // seulement on ne sait pas le retrouver : rien ne sera mémorisé
      block = ''
    }
    return { before, after, change: res.change, block }
  } catch (e) {
    useToast().show(errorMessage(e) ?? 'Strava a refusé la modification')
    return null
  }
}

/** Le cookie de démo est lisible côté serveur : pas de flash entre démo et état vide. */
export const DEMO_COOKIE = 'sxg-demo'
export function isDemoCookie() {
  return useCookie<boolean>(DEMO_COOKIE).value === true
}
