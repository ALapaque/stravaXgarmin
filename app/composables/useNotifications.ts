export type NotifKind = 'titles' | 'records' | 'review' | 'recap'

export interface AppNotification {
  id: string
  kind: NotifKind
  title: string
  body: string
  to?: string
  at: string
  read: boolean
}

export const NOTIF_KINDS: Record<NotifKind, { label: string; hint: string }> = {
  titles: { label: 'Titres appliqués', hint: 'Quand un nom est copié ou publié sur Strava' },
  records: { label: 'Records', hint: 'Quand tu bats un record personnel' },
  review: { label: 'Courses à valider', hint: 'Quand un nom attend ton accord' },
  recap: { label: 'Récaps', hint: 'Chaque lundi et chaque début de mois' },
}

export const demoNotifications = (): AppNotification[] => [
  {
    id: 'n1',
    kind: 'review',
    title: '2 courses attendent ta validation',
    body: '« Morning Run » et « Afternoon Run » peuvent être renommées.',
    to: '/activites',
    at: '2026-11-17T19:40:00+01:00',
    read: false,
  },
  {
    id: 'n2',
    kind: 'recap',
    title: 'Ton récap de la semaine est prêt',
    body: '17,4 km sur la semaine du 9 novembre.',
    to: '/recap',
    at: '2026-11-16T08:00:00+01:00',
    read: false,
  },
  {
    id: 'n3',
    kind: 'records',
    title: 'Nouveau record sur 10 km',
    body: '52:10 pendant ta sortie longue de dimanche.',
    to: '/activites/a1',
    at: '2026-11-15T10:45:00+01:00',
    read: true,
  },
  {
    id: 'n4',
    kind: 'records',
    title: 'Nouveau record sur 5 km',
    body: '23:25, soit 33 s de mieux que ton ancien record.',
    to: '/activites/a4',
    at: '2026-11-10T17:40:00+01:00',
    read: true,
  },
]

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
