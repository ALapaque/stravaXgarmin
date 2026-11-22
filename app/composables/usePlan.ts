/*
 * Prochaines séances : lues dans le calendrier Garmin (séances Kiprun exportées vers Garmin,
 * plans Garmin Coach, séances ajoutées à la main). Gardées dans le navigateur entre deux visites.
 */
export type PlanKind = 'warmup' | 'cooldown' | 'interval' | 'recovery' | 'rest' | 'other'

export interface PlanLine {
  kind: PlanKind | 'repeat'
  text: string
  reps?: number
  children?: PlanLine[]
}

export interface PlanSession {
  id: string
  date: string
  title: string
  description: string | null
  provider: string | null
  durationSec: number | null
  distanceM: number | null
  lines: PlanLine[]
  blocks: { kind: PlanKind; sec: number; level: number }[]
}

function addDays(n: number) {
  const d = new Date(`${TODAY}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

const rep = (n: number, b: PlanSession['blocks']) => Array.from({ length: n }, () => b).flat()

function demoPlan(): PlanSession[] {
  return [
    {
      id: 'p1',
      date: addDays(1),
      title: 'Fractionné 6 × 800 m',
      description: 'Séance VMA du plan semi-marathon',
      provider: 'Kiprun Pacer',
      durationSec: 3300,
      distanceM: 9800,
      lines: [
        { kind: 'warmup', text: 'Échauffement · 20 min à 6:00–6:20 /km' },
        {
          kind: 'repeat',
          reps: 6,
          text: '6 ×',
          children: [
            { kind: 'interval', text: 'Effort · 800 m à 4:05–4:15 /km' },
            { kind: 'recovery', text: 'Récup · 2 min' },
          ],
        },
        { kind: 'cooldown', text: 'Retour au calme · 10 min' },
      ],
      blocks: [
        { kind: 'warmup', sec: 1200, level: 0.42 },
        ...rep(6, [
          { kind: 'interval', sec: 200, level: 0.92 },
          { kind: 'recovery', sec: 120, level: 0.28 },
        ]),
        { kind: 'cooldown', sec: 600, level: 0.38 },
      ],
    },
    {
      id: 'p2',
      date: addDays(3),
      title: 'Footing en endurance',
      description: null,
      provider: 'Kiprun Pacer',
      durationSec: 2700,
      distanceM: 7500,
      lines: [{ kind: 'other', text: 'Course · 45 min à 5:50–6:10 /km' }],
      blocks: [{ kind: 'other', sec: 2700, level: 0.5 }],
    },
    {
      id: 'p3',
      date: addDays(5),
      title: 'Sortie longue avec allure semi',
      description: 'Les 3 derniers km à allure course',
      provider: 'Kiprun Pacer',
      durationSec: 5700,
      distanceM: 16000,
      lines: [
        { kind: 'warmup', text: 'Échauffement · 15 min' },
        { kind: 'other', text: 'Course · 10 km à 5:30–5:45 /km' },
        { kind: 'interval', text: 'Effort · 3 km à 4:45–4:55 /km' },
        { kind: 'cooldown', text: 'Retour au calme · 10 min' },
      ],
      blocks: [
        { kind: 'warmup', sec: 900, level: 0.42 },
        { kind: 'other', sec: 3400, level: 0.58 },
        { kind: 'interval', sec: 870, level: 0.8 },
        { kind: 'cooldown', sec: 600, level: 0.38 },
      ],
    },
  ]
}

export function usePlan() {
  const state = useState<{ at: string; list: PlanSession[] } | null>('plan', () => (isDemoCookie() ? { at: '', list: demoPlan() } : null))
  const upcoming = computed(() => (state.value?.list ?? []).filter((s) => s.date >= TODAY))
  const next = computed(() => upcoming.value[0])

  /** Relit le calendrier Garmin, au plus toutes les 10 minutes. */
  async function load(force = false) {
    const at = state.value?.at
    if (!force && at && Date.now() - Date.parse(at) < 10 * 60_000) return
    const list = await useHealth().track(
      'garmin.plan',
      () => $fetch<PlanSession[]>('/api/garmin/plan'),
      (l) => HEALTH_INFO.plan(l.filter((s) => s.date >= TODAY).length),
    )
    // La liste remplace entièrement l'ancienne ; un doublon éventuel n'est gardé qu'une fois
    const unique = list.filter((s, i) => list.findIndex((o) => o.id === s.id || (o.date === s.date && o.title === s.title)) === i)
    state.value = { at: new Date().toISOString(), list: unique }
  }

  function reset(demo: boolean) {
    state.value = demo ? { at: '', list: demoPlan() } : null
  }

  return { state, upcoming, next, load, reset }
}

/** « Demain », « Jeudi 20 nov. »… */
export function planDay(date: string) {
  const diff = Math.round((Date.parse(`${date}T12:00:00Z`) - Date.parse(`${TODAY}T12:00:00Z`)) / 86_400_000)
  if (diff === 0) return 'Aujourd’hui'
  if (diff === 1) return 'Demain'
  const s = new Intl.DateTimeFormat('fr-BE', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`))
  return s.charAt(0).toUpperCase() + s.slice(1)
}
