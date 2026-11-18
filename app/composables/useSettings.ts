import type { NotifKind } from './useNotifications'

export function useSettings() {
  return useState('settings', () => ({
    autoSync: true,
    overwriteEdited: false,
    naming: {
      /** Remplace les noms génériques (« Morning Run »…) par la règle du type de séance */
      enabled: true,
      templates: { ...DEFAULT_TEMPLATES },
    },
    description: {
      enabled: true,
      weather: true,
      splits: true,
      shoes: true,
      signature: true,
    },
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
