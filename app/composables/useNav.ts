/* Menu principal et icônes des rubriques, partagés par la barre du bas et la barre latérale. */
import {
  House, Activity, CalendarClock, ChartColumn, SlidersHorizontal,
  HeartPulse, Trophy, Sparkles, Footprints, Link2, RefreshCw, Bell, Palette, Gauge, PenLine,
} from 'lucide-vue-next'

export const NAV = [
  { to: '/', label: 'Accueil', icon: House, match: (p: string) => p === '/' || p.startsWith('/notifications') },
  { to: '/activites', label: 'Activités', icon: Activity, match: (p: string) => p.startsWith('/activites') },
  { to: '/plan', label: 'Plan', icon: CalendarClock, match: (p: string) => p.startsWith('/plan') },
  { to: '/stats', label: 'Stats', icon: ChartColumn, match: (p: string) => p.startsWith('/stats') || p.startsWith('/recap') || p.startsWith('/objectif') },
  { to: '/reglages', label: 'Réglages', icon: SlidersHorizontal, match: (p: string) => p.startsWith('/reglages') || p.startsWith('/historique') },
]

export const SUB_ICONS: Record<string, unknown> = {
  forme: HeartPulse, records: Trophy, ia: Sparkles, shoes: Footprints,
  accounts: Link2, sync: RefreshCw, bell: Bell, style: Palette,
  numbers: Gauge, name: PenLine,
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
