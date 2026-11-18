import type { Activity, ChangeSource } from './useActivities'
import { pushField } from './useActivities'

export interface HistoryEntry {
  id: string
  activityId: string
  field: 'name' | 'description' | 'garminName'
  before: string
  after: string
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
}

/** Journal de tout ce que l'appli a modifié sur Strava, avec annulation. */
export function useHistory() {
  const entries = useState<HistoryEntry[]>('history', () => [
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
  ])

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
    if (!(await pushField(a, entry.field, entry.before))) return false
    if (entry.field === 'name') a.stravaName = entry.before
    else if (entry.field === 'garminName') a.garminName = entry.before
    else a.stravaDescription = entry.before || undefined
    entry.undone = true
    return true
  }

  return { entries, record, undo }
}
