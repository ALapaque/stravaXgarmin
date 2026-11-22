/*
 * Titres et analyses par IA : routes serveur qui appellent OpenAI avec la clé de l'utilisateur.
 * Les erreurs (clé refusée, crédit épuisé…) remontent avec un message en français.
 */
import type { Activity } from './useActivities'
import { MAX_NOTE, type PlanContext } from '#shared/utils/debrief'
import type { ReviewFeeling, ReviewPlan } from '#shared/utils/bilan'

export type TitleStyle = 'sobre' | 'drole' | 'epique'

export const TITLE_STYLES: { id: TitleStyle; label: string }[] = [
  { id: 'sobre', label: 'Sobre' },
  { id: 'drole', label: 'Drôle' },
  { id: 'epique', label: 'Épique' },
]

export interface Analysis {
  score: number
  verdict: string
  findings: { kind: 'ok' | 'ko' | 'tip'; title: string; text: string }[]
}

export interface WeekReview {
  headline: string
  wins: string[]
  watch: string[]
  next: string
}

export interface Level {
  vma: number
  vo2max: number
  threshold: string
  half: string
  count: number
}

/** Derniers résultats IA, gardés dans le navigateur pour ne pas les perdre en changeant de page. */
export function useAiResults() {
  return useState<{
    level: (Level & { at: string }) | null
    analyses: Record<string, Analysis & { at: string }>
    /** Ancien bilan des 7 derniers jours (versions précédentes) : gardé, plus affiché */
    week?: (WeekReview & { at: string; key: string }) | null
    /** Lecture de chaque semaine par l'IA, par lundi ; « key » dit pour quelles courses elle a été écrite */
    reviews?: Record<string, WeekReview & { at: string; key: string }>
  }>('aiResults', () => ({ level: null, analyses: {}, week: null }))
}

/** Ce qui part chez l'IA : les chiffres de la course, son titre nettoyé et « sur tapis », rien d'autre. */
const toRun = (a: Activity) => ({
  type: a.type,
  startedAt: a.startedAt,
  place: a.indoor ? '' : a.place,
  indoor: a.indoor,
  distanceKm: a.distanceKm,
  durationSec: a.durationSec,
  avgHr: a.avgHr,
  elevationM: a.elevationM,
  splits: a.splits,
  title: displayTitle(a).title,
  stravaId: a.stravaId,
})

export const aiError = (e: unknown) =>
  (e as { data?: { statusMessage?: string } }).data?.statusMessage ?? 'L’IA ne répond pas pour le moment'

export function useAi() {
  const { refresh } = useAccounts()
  const { track } = useHealth()

  async function call<T>(url: string, body: Record<string, unknown>): Promise<T> {
    try {
      return (await track('ai', () => $fetch(url, { method: 'POST', body }), () => HEALTH_INFO.ai())) as T
    } catch (e) {
      // Clé révoquée côté OpenAI : le serveur l'a oubliée, on remet les écrans à jour
      if ((e as { statusCode?: number }).statusCode === 401) await refresh()
      throw e
    }
  }

  /** Trois titres seuls (sans étiquettes : l'appli les ajoute). « planTitle » : titre de la séance prévue. */
  async function suggestTitles(a: Activity, style: TitleStyle, avoid: string[] = [], planTitle?: string | null) {
    const { titles } = await call<{ titles: string[] }>('/api/ai/titles', { run: toRun(a), style, avoid, ...(planTitle ? { planTitle } : {}) })
    return titles
  }

  const settings = useSettings()

  /**
   * Analyse d'une course. Le Débrief y joint la séance prévue et le ressenti ; la note n'est mise dans
   * la requête que si le réglage « L’analyse tient compte de ma note » est activé.
   */
  function analyse(a: Activity, ctx: { plan?: PlanContext | null; rpe?: number | null; note?: string } = {}) {
    const note = settings.value.ai?.shareNote ? (ctx.note ?? '').trim().slice(0, MAX_NOTE) : ''
    const feeling = ctx.rpe || note ? { rpe: ctx.rpe ?? null, ...(note ? { note } : {}) } : undefined
    return call<Analysis>('/api/ai/analyse', { run: toRun(a), ...(ctx.plan ? { plan: ctx.plan } : {}), ...(feeling ? { feeling } : {}) })
  }
  const estimateLevel = (selected: Activity[]) => call<Level>('/api/ai/level', { runs: selected.map(toRun) })
  /** Bilan de la semaine : chiffres des courses, plan suivi et ressentis sur 10 (reviewContext), jamais les notes écrites. */
  const reviewWeek = (runs: Activity[], extra: { previous?: { km: number; count: number }; next?: string[]; goal?: string; plan?: ReviewPlan; feelings?: ReviewFeeling[] }) =>
    call<WeekReview>('/api/ai/week', { runs: runs.map(toRun), ...extra })

  return { suggestTitles, analyse, estimateLevel, reviewWeek }
}
