import type { Activity, BlockKind, ChangeSource } from './useActivities'
import { pushField, sendBlock, usePublished } from './useActivities'

export interface HistoryEntry {
  id: string
  activityId: string
  field: 'name' | 'description' | 'garminName'
  /** Valeur complète avant/après (pour une description : toute la description) */
  before: string
  after: string
  /** Description : texte de l'appli ajouté (absent des anciennes entrées : on prend « after ») */
  block?: string
  /** Description : texte de l'appli que ce bloc a remplacé, '' s'il a été ajouté à la suite */
  previousBlock?: string
  source: ChangeSource
  at: string
  undone?: boolean
}

export const SOURCE_LABELS: Record<ChangeSource, string> = {
  garmin: 'Copié depuis Garmin',
  regle: 'Règle de nommage',
  ia: 'Titre IA',
  manuel: 'Titre manuel',
  record: 'Titre record',
  description: 'Description enrichie',
  strava: 'Depuis Strava',
  analyse: 'Analyse IA',
}

export const demoHistory = (): HistoryEntry[] => [
  {
    id: 'seed-1',
    activityId: 'a1',
    field: 'name',
    before: 'Morning Run',
    after: 'Sortie longue',
    source: 'garmin',
    at: '2026-11-15T10:42:00+01:00',
  },
  {
    id: 'seed-2',
    activityId: 'a3',
    field: 'name',
    before: 'Morning Run',
    after: 'Footing récup',
    source: 'garmin',
    at: '2026-11-16T08:01:00+01:00',
  },
]

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
    const kind: BlockKind = entry.source === 'analyse' ? 'analyse' : 'infos'
    const published = usePublished()
    const mine = { ...published.value[a.id] }
    if (r.block) mine[kind] = r.block
    else delete mine[kind]
    published.value = { ...published.value, [a.id]: mine }
    return true
  }

  return { entries, record, undo }
}
