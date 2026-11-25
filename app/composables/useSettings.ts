import type { NotifKind } from './useNotifications'
import { DEFAULT_PARTS, type DebriefParts } from '#shared/utils/debrief'
import type { ZoneChoice } from '#shared/utils/zones'

export function useSettings() {
  return useState('settings', () => ({
    autoSync: true,
    overwriteEdited: false,
    /** Date de la première synchro réelle : seules les courses suivantes sont renommées automatiquement */
    autoSince: '' as string,
    naming: {
      /** Remplace les noms génériques (« Morning Run »…) par la règle du type de séance */
      enabled: true,
      templates: { ...DEFAULT_TEMPLATES },
    },
    /*
     * Parties du texte que le Débrief ajoute sous ta description Strava (shared/utils/debrief.ts).
     * Un état gardé par une version précédente garde ses anciennes clés (enabled, weather, splits) : ignorées.
     */
    description: { ...DEFAULT_PARTS } as DebriefParts,
    /** L'analyse IA tient compte de ta note (envoyée au fournisseur d'IA) */
    ai: { shareNote: false },
    notify: {
      /** Notifications système (en plus du centre de notifications) */
      system: false,
      kinds: { titles: true, records: true, review: true, recap: true } as Record<NotifKind, boolean>,
    },
    garmin: {
      /** Renommer aussi dans Garmin Connect (API non officielle) */
      rename: false,
    },
    accounts: { chatgpt: false },
    /** Prochaine course visée (nom, date, distance) */
    goal: null as { name: string; date: string; distance: '5k' | '10k' | 'half' | 'marathon' } | null,
    /** Kilométrage à partir duquel une paire de chaussures est considérée usée */
    shoeLimitKm: 700,
    /** Convention de titres « [SOURCE] - Titre » : auto (détectée dans tes titres Strava), toujours, jamais */
    tags: { mode: 'auto' as 'auto' | 'on' | 'off', fail: 'FAIL', sources: [] as string[] },
    /** Zones cardio : « auto » (ta montre si Garmin est connecté, sinon Strava), ta montre, Strava, ou calculées sur ta FC max */
    zoneSource: 'auto' as ZoneChoice,
    /** FC max saisie par toi (prioritaire sur l'estimation) */
    hrMax: null as number | null,
    /** Seules les courses après cette date réclament un débrief (posée à la première ouverture réelle) */
    debriefSince: '' as string,
  }))
}

export interface ToastAction {
  label: string
  run: () => void
}

export function useToast() {
  const message = useState<string | null>('toast', () => null)
  const action = useState<ToastAction | null>('toast-action', () => null)
  let timer: ReturnType<typeof setTimeout> | undefined

  function show(text: string, act?: ToastAction) {
    message.value = text
    action.value = act ?? null
    clearTimeout(timer)
    timer = setTimeout(() => {
      message.value = null
      action.value = null
    }, act ? 5000 : 2600)
  }

  function dismiss() {
    clearTimeout(timer)
    message.value = null
    action.value = null
  }

  return { message, action, show, dismiss }
}
