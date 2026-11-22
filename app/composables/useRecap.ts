import type { Activity } from './useActivities'

export type RecapKind = 'semaine' | 'mois'

const DAY = 86_400_000
const iso = (d: Date) => d.toISOString().slice(0, 10)
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY)
const monthName = (d: Date) => new Intl.DateTimeFormat('fr-BE', { month: 'long', timeZone: 'UTC' }).format(d)

interface Range {
  from: string
  to: string
}

function inRange(a: Activity, r: Range) {
  const k = a.localDate
  return k >= r.from && k <= r.to
}

function totals(runs: Activity[]) {
  const km = runs.reduce((s, a) => s + a.distanceKm, 0)
  const sec = runs.reduce((s, a) => s + a.durationSec, 0)
  return {
    km,
    sec,
    count: runs.length,
    elevation: runs.reduce((s, a) => s + a.elevationM, 0),
    pace: km ? formatPace(sec, km) : '–',
  }
}

/**
 * Chiffres du bilan : la semaine choisie (lundi « week » → dimanche, la semaine en cours par défaut)
 * ou le mois en cours, comparés à la période précédente.
 */
export function useRecap(kind: Ref<RecapKind>, week?: Ref<string>) {
  const { activities } = useActivities()
  const { recordsOf } = useRecords()

  return computed(() => {
    const today = new Date(`${TODAY}T12:00:00Z`)
    let current: Range
    let previous: Range
    let title: string
    let compareLabel: string
    let buckets: { label: string; from: string; to: string }[]

    if (kind.value === 'semaine') {
      const thisMonday = addDays(today, -((today.getUTCDay() + 6) % 7))
      const monday = week?.value ? new Date(`${week.value}T12:00:00Z`) : thisMonday
      current = { from: iso(monday), to: iso(addDays(monday, 6)) }
      previous = { from: iso(addDays(monday, -7)), to: iso(addDays(monday, -1)) }
      title = `Semaine du ${monday.getUTCDate()} ${monthName(monday)}`
      compareLabel = iso(monday) === iso(thisMonday) ? 'la semaine dernière' : 'la semaine d’avant'
      buckets = Array.from({ length: 7 }, (_, i) => {
        const d = addDays(monday, i)
        const k = iso(d)
        return {
          label: new Intl.DateTimeFormat('fr-BE', { weekday: 'narrow', timeZone: 'UTC' }).format(d),
          from: k,
          to: k,
        }
      })
    } else {
      const first = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1, 12))
      const last = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0, 12))
      const prevFirst = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1, 12))
      current = { from: iso(first), to: iso(last) }
      // Comparaison à date égale : du 1er au même jour du mois précédent
      previous = { from: iso(prevFirst), to: iso(addDays(prevFirst, today.getUTCDate() - 1)) }
      const m = monthName(first)
      title = m.charAt(0).toUpperCase() + m.slice(1)
      const pm = monthName(prevFirst)
      const of = /^[aeiouéèâ]/i.test(pm) ? `d’${pm}` : `de ${pm}`
      compareLabel = `la même période ${of} (${today.getUTCDate() === 1 ? 'le 1er' : `du 1er au ${today.getUTCDate()}`})`
      buckets = []
      for (let start = 1; start <= last.getUTCDate(); start += 7) {
        const end = Math.min(start + 6, last.getUTCDate())
        buckets.push({
          label: `${start}–${end}`,
          from: iso(addDays(first, start - 1)),
          to: iso(addDays(first, end - 1)),
        })
      }
    }

    const runs = activities.value.filter((a) => inRange(a, current))
    const prevRuns = activities.value.filter((a) => inRange(a, previous))
    const now = totals(runs)
    const before = totals(prevRuns)

    return {
      from: current.from,
      to: current.to,
      title,
      compareLabel,
      ...now,
      deltaPct: before.km ? Math.round(((now.km - before.km) / before.km) * 100) : null,
      longest: [...runs].sort((a, b) => b.distanceKm - a.distanceKm)[0],
      records: runs.flatMap((a) => recordsOf(a).map((r) => ({ ...r, activity: a }))),
      bars: buckets.map((b) => ({
        label: b.label,
        future: b.from > TODAY,
        km: runs.filter((a) => inRange(a, b)).reduce((s, a) => s + a.distanceKm, 0),
      })),
    }
  })
}
