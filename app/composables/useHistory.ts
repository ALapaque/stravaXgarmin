// Forme des données : shared/utils/model.ts
import type { HistoryEntry } from '#shared/utils/model'
export type { HistoryEntry } from '#shared/utils/model'
import type { Activity, ChangeSource } from './useActivities'
import { pushField, rememberBlock, sendBlock } from './useActivities'

export const SOURCE_LABELS: Record<ChangeSource, string> = {
  garmin: 'Copié depuis Garmin',
  regle: 'Règle de nommage',
  ia: 'Titre IA',
  manuel: 'Titre manuel',
  record: 'Titre record',
  description: 'Description enrichie',
  strava: 'Depuis Strava',
  analyse: 'Analyse IA',
  debrief: 'Débrief',
}

export const demoHistory = (): HistoryEntry[] => demoData().history

/** Journal de tout ce que l'appli a modifié sur Strava, avec annulation. */
export function useHistory() {
  const entries = useState<HistoryEntry[]>('history', () => (isDemoCookie() ? demoHistory() : []))

  function record(e: Omit<HistoryEntry, 'id' | 'at'>) {
    const entry: HistoryEntry = { ...e, id: `h${Date.now()}${Math.random().toString(36).slice(2, 6)}`, at: new Date().toISOString() }
    entries.value.unshift(entry)
    return entry
  }

  /** Remet l'ancienne valeur (sur Strava ou Garmin), sans créer de nouvelle entrée. */
  async function undo(id: string) {
    const entry = entries.value.find((e) => e.id === id)
    if (!entry || entry.undone) return false
    const activities = useState<Activity[]>('activities')
    const a = activities.value.find((x) => x.id === entry.activityId)
    if (!a) return false
    if (entry.field === 'description') {
      if (!(await undoDescription(a, entry))) return false
    } else {
      if (!(await pushField(a, entry.field, entry.before))) return false
      if (entry.field === 'name') a.stravaName = entry.before
      else a.garminName = entry.before
    }
    entry.undone = true
    return true
  }

  /*
   * Annuler un texte de description : on demande de remettre l'ancien texte de l'appli à la place du bloc,
   * dans la description TELLE QU'ELLE EST MAINTENANT (relue par le serveur). Le reste n'est jamais touché,
   * et on ne remet jamais une description complète.
   */
  async function undoDescription(a: Activity, entry: HistoryEntry) {
    const block = entry.block ?? entry.after
    const previousBlock = entry.previousBlock ?? ''
    const r = await sendBlock(a, previousBlock, block)
    if (!r) return false
    if (r.change === 'none' || r.change === 'full') {
      useToast().show('Ce texte a changé sur Strava depuis : rien n’a été retiré.')
      return false
    }
    a.stravaDescription = r.after
    // Les anciennes entrées n'ont pas de sorte : règle d'avant la phase 3
    const kind: BlockKind = entry.kind ?? (entry.source === 'analyse' ? 'analyse' : 'infos')
    rememberBlock(a.id, kind, r.block)
    // Débrief retiré de Strava : la course redevient « à débriefer » (ce qui a été saisi est gardé)
    if (kind === 'debrief' && !r.block) {
      const debriefs = useDebriefState()
      const d = debriefs.value?.[a.id]
      if (d) debriefs.value = { ...debriefs.value, [a.id]: { ...d, status: 'draft', publishedAt: null } }
    }
    return true
  }

  return { entries, record, undo }
}
