/*
 * Forme (Garmin), charge hebdomadaire (courses chargées), objectif course et chaussures (Strava).
 * Tout est gardé dans le navigateur entre deux visites.
 */
import type { EffortKey } from './useActivities'

export interface Forme {
  vo2max: number | null
  status: { label: string; tone: 'ok' | 'warn' | 'ko' | 'idle' } | null
  load: { acute: number; chronic: number | null; ratio: number | null } | null
  readiness: { score: number; level: string } | null
  recoveryHours: number | null
  predictions: Record<EffortKey, number | null> | null
}

export interface Gear {
  id: string
  name: string
  km: number
  primary: boolean
  retired: boolean
}

export interface Goal {
  name: string
  date: string
  distance: EffortKey
}

const demoForme = (): Forme => ({
  vo2max: 52,
  status: { label: 'Productif', tone: 'ok' },
  load: { acute: 412, chronic: 380, ratio: 1.1 },
  readiness: { score: 68, level: 'MODERATE' },
  recoveryHours: 14,
  predictions: { '5k': 1372, '10k': 2865, half: 6390, marathon: 13560 },
})

const demoGear = (): Gear[] => [
  { id: 'g1', name: SHOES.peg.name, km: SHOES.peg.km, primary: true, retired: false },
  { id: 'g2', name: SHOES.vf.name, km: SHOES.vf.km, primary: false, retired: false },
]

const DAY = 86_400_000

export function useFitness() {
  const forme = useState<{ at: string; data: Forme } | null>('forme', () => (isDemoCookie() ? { at: '', data: demoForme() } : null))
  const gear = useState<{ at: string; list: Gear[] } | null>('gear', () => (isDemoCookie() ? { at: '', list: demoGear() } : null))
  const { activities } = useActivities()
  const settings = useSettings()

  async function loadForme(force = false) {
    const at = forme.value?.at
    if (!force && at && Date.now() - Date.parse(at) < 15 * 60_000) return
    const data = await useHealth().track('garmin.forme', () => $fetch<Forme>('/api/garmin/forme'), (f) => HEALTH_INFO.forme(f))
    forme.value = { at: new Date().toISOString(), data }
  }

  /*
   * Chaussures des courses chargées. Le kilométrage change dès qu'on court ou qu'on associe
   * une paire à d'anciennes courses dans Strava : il est relu à chaque ouverture de l'appli
   * (au plus toutes les 5 minutes), pour que tous les appareils affichent la même chose.
   */
  async function loadGear(force = false) {
    const ids = [...new Set(activities.value.map((a) => a.gearId).filter((id): id is string => Boolean(id)))]
    if (!ids.length) return
    const known = new Set(gear.value?.list.map((g) => g.id))
    const fresh = gear.value?.at && Date.now() - Date.parse(gear.value.at) < 5 * 60_000
    if (!force && fresh && ids.every((id) => known.has(id))) return applyGear()
    const list = await useHealth().track(
      'strava.gear',
      () => $fetch<Gear[]>('/api/strava/gear', { method: 'POST', body: { ids } }),
      (l) => HEALTH_INFO.gear(l.filter((g) => !g.retired).length),
    )
    if (list.length) gear.value = { at: new Date().toISOString(), list }
    applyGear()
  }

  function applyGear() {
    const byId = new Map(gear.value?.list.map((g) => [g.id, g]))
    for (const a of activities.value) {
      const g = a.gearId ? byId.get(a.gearId) : undefined
      if (g) a.shoe = { name: g.name, km: g.km }
    }
  }

  function reset(demo: boolean) {
    forme.value = demo ? { at: '', data: demoForme() } : null
    gear.value = demo ? { at: '', list: demoGear() } : null
  }

  /** Kilomètres des 8 dernières semaines (lundi → dimanche), la plus ancienne d'abord. */
  const weeks = computed(() => {
    const today = new Date(`${TODAY}T12:00:00Z`)
    const monday = new Date(today.getTime() - ((today.getUTCDay() + 6) % 7) * DAY)
    return Array.from({ length: 8 }, (_, i) => {
      const from = new Date(monday.getTime() - (7 - i) * 7 * DAY)
      const a = from.toISOString().slice(0, 10)
      const b = new Date(from.getTime() + 6 * DAY).toISOString().slice(0, 10)
      const runs = activities.value.filter((r) => r.localDate >= a && r.localDate <= b)
      return {
        from: a,
        label: `${from.getUTCDate()}/${from.getUTCMonth() + 1}`,
        km: runs.reduce((s, r) => s + r.distanceKm, 0),
        current: i === 7,
      }
    })
  })

  /**
   * Hausse de charge : les 7 derniers jours comparés à la moyenne des 3 semaines d'avant.
   * Au-delà de +30 %, le risque de blessure monte : on prévient.
   */
  const ramp = computed(() => {
    const end = Date.parse(`${TODAY}T23:59:59Z`)
    const km = (fromDays: number, toDays: number) =>
      activities.value
        .filter((r) => {
          const t = Date.parse(r.startedAt)
          return t > end - fromDays * DAY && t <= end - toDays * DAY
        })
        .reduce((s, r) => s + r.distanceKm, 0)
    const now = km(7, 0)
    const before = (km(14, 7) + km(21, 14) + km(28, 21)) / 3
    if (before < 8) return null
    const pct = Math.round(((now - before) / before) * 100)
    return { now, before, pct, high: pct >= 30 }
  })

  const goal = computed<Goal | null>({
    get: () => settings.value.goal,
    set: (g) => (settings.value.goal = g),
  })
  const goalInfo = computed(() => {
    const g = goal.value
    if (!g?.date) return null
    const days = Math.round((Date.parse(`${g.date}T12:00:00Z`) - Date.parse(`${TODAY}T12:00:00Z`)) / DAY)
    return { ...g, days, weeks: Math.floor(days / 7), predicted: forme.value?.data.predictions?.[g.distance] ?? null, past: days < 0 }
  })

  /** Paires actives, la plus utilisée d'abord, avec leur usure par rapport à la limite choisie. */
  const shoes = computed(() =>
    (gear.value?.list ?? [])
      .filter((g) => !g.retired)
      .sort((a, b) => b.km - a.km)
      .map((g) => ({ ...g, wear: Math.min(g.km / settings.value.shoeLimitKm, 1), worn: g.km >= settings.value.shoeLimitKm, soon: g.km >= settings.value.shoeLimitKm * 0.85 })),
  )

  return { forme, gear, weeks, ramp, goal, goalInfo, shoes, loadForme, loadGear, reset }
}

export const GOAL_DISTANCES: { id: EffortKey; label: string }[] = [
  { id: '5k', label: '5 km' },
  { id: '10k', label: '10 km' },
  { id: 'half', label: 'Semi' },
  { id: 'marathon', label: 'Marathon' },
]
