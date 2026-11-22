/*
 * Titres et analyses par IA : routes serveur qui appellent OpenAI avec la clé de l'utilisateur.
 * Les erreurs (clé refusée, crédit épuisé…) remontent avec un message en français.
 */
import type { Activity } from './useActivities'

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
    /** Dernier bilan de semaine ; « key » dit pour quelles courses il a été écrit */
    week?: (WeekReview & { at: string; key: string }) | null
  }>('aiResults', () => ({ level: null, analyses: {}, week: null }))
}

/** Ce qui part chez l'IA : les chiffres de la course, rien d'autre. */
const toRun = (a: Activity) => ({
  type: a.type,
  startedAt: a.startedAt,
  place: a.place,
  distanceKm: a.distanceKm,
  durationSec: a.durationSec,
  avgHr: a.avgHr,
  elevationM: a.elevationM,
  splits: a.splits,
  garminName: a.garminName,
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

  async function suggestTitles(a: Activity, style: TitleStyle, avoid: string[] = []) {
    const { titles } = await call<{ titles: string[] }>('/api/ai/titles', { run: toRun(a), style, avoid })
    return titles
  }

  const analyse = (a: Activity) => call<Analysis>('/api/ai/analyse', { run: toRun(a) })
  const estimateLevel = (selected: Activity[]) => call<Level>('/api/ai/level', { runs: selected.map(toRun) })
  const reviewWeek = (runs: Activity[], extra: { previous?: { km: number; count: number }; next?: string[]; goal?: string }) =>
    call<WeekReview>('/api/ai/week', { runs: runs.map(toRun), ...extra })

  return { suggestTitles, analyse, estimateLevel, reviewWeek }
}
