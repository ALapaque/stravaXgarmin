// Forme des données : shared/utils/model.ts
import type { AppNotification, NotifKind } from '#shared/utils/model'
export type { AppNotification, NotifKind } from '#shared/utils/model'

export const NOTIF_KINDS: Record<NotifKind, { label: string; hint: string }> = {
  titles: { label: 'Titres appliqués', hint: 'Quand un nom est copié ou publié sur Strava' },
  records: { label: 'Records', hint: 'Quand tu bats un record personnel' },
  review: { label: 'Courses à débriefer', hint: 'Quand une séance attend son débrief' },
  recap: { label: 'Récaps', hint: 'Chaque lundi et chaque début de mois' },
}

export const demoNotifications = (): AppNotification[] => demoData().notifications

/**
 * Centre de notifications de l'appli + notifications système quand c'est autorisé.
 * Pour des notifications appli fermée, il faudra du Web Push (clés VAPID + route serveur).
 */
export function useNotifications() {
  const settings = useSettings()
  const list = useState<AppNotification[]>('notifications', () => (isDemoCookie() ? demoNotifications() : []))

  const unread = computed(() => list.value.filter((n) => !n.read).length)
  const permission = useState<NotificationPermission | 'unsupported'>('notif-permission', () => 'default')

  function syncPermission() {
    permission.value = typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
  }

  async function requestPermission() {
    if (typeof Notification === 'undefined') {
      permission.value = 'unsupported'
      return false
    }
    permission.value = await Notification.requestPermission()
    return permission.value === 'granted'
  }

  async function notify(n: Omit<AppNotification, 'id' | 'at' | 'read'>) {
    if (!settings.value.notify.kinds[n.kind]) return
    list.value.unshift({ ...n, id: `n${Date.now()}`, at: new Date().toISOString(), read: false })

    if (!settings.value.notify.system || typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    const options: NotificationOptions = { body: n.body, icon: '/pwa-192.png', badge: '/pwa-192.png', tag: n.kind, data: { to: n.to } }
    try {
      const reg = await navigator.serviceWorker?.getRegistration()
      if (reg) await reg.showNotification(n.title, options)
      else new Notification(n.title, options)
    } catch {
      // Certains navigateurs refusent new Notification() hors service worker : le centre suffit
    }
  }

  function markAllRead() {
    list.value.forEach((n) => (n.read = true))
  }

  return { list, unread, permission, syncPermission, requestPermission, notify, markAllRead }
}
