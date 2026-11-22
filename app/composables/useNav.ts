/* Menu principal (trois onglets) et icônes des rubriques, partagés par la barre du bas et la barre latérale. */
import {
  Sunrise, NotebookText, TrendingUp,
  HeartPulse, Trophy, Sparkles, Footprints, Link2, RefreshCw, Bell, Palette, Gauge, PenLine,
  Rows3, CalendarClock, ClipboardCheck,
} from 'lucide-vue-next'

/*
 * Chaque onglet répond à une question du coureur. Sur les pages de réglages (et l'historique),
 * aucun onglet n'est actif : on y entre par l'avatar.
 */
export const NAV = [
  { to: '/', label: 'Aujourd’hui', icon: Sunrise, match: (p: string) => p === '/' || p.startsWith('/notifications') },
  { to: '/journal', label: 'Journal', icon: NotebookText, match: (p: string) => p.startsWith('/journal') || p.startsWith('/activites') },
  {
    to: '/progression',
    label: 'Progression',
    icon: TrendingUp,
    match: (p: string) => p.startsWith('/progression') || p.startsWith('/bilan') || p.startsWith('/recap') || p.startsWith('/objectif'),
  },
]

export const SUB_ICONS: Record<string, unknown> = {
  forme: HeartPulse, records: Trophy, ia: Sparkles, shoes: Footprints,
  accounts: Link2, sync: RefreshCw, bell: Bell, style: Palette,
  numbers: Gauge, name: PenLine,
  all: Rows3, upcoming: CalendarClock, todo: ClipboardCheck,
}

export function useNav() {
  const route = useRoute()
  const router = useRouter()
  const active = computed(() => NAV.findIndex((t) => t.match(route.path)))
  const sub = useSubnavState()
  /** Ouvre une rubrique de l'écran courant (gardée dans l'adresse) */
  const pick = (id: string) => router.replace({ query: { ...route.query, onglet: id } })
  return { active, sub, pick }
}

/** Prénom du coureur (fictif et flouté en démo) et son initiale, pour l'en-tête et l'avatar. */
export function useRunner() {
  const { accounts } = useAccounts()
  const { active: demo } = useDemo()
  const firstName = computed(() => (demo.value ? 'Alex' : (accounts.value.strava.name ?? '').split(' ')[0] ?? ''))
  const initial = computed(() => (firstName.value || '?').charAt(0).toUpperCase())
  return { firstName, initial, masked: demo }
}
