/*
 * Détail de quelques courses Strava : meilleurs efforts (avec record ou non), temps et FC au km,
 * tours de la montre et FC max. Strava limite les appels (100 par quart d'heure) : l'appli ne demande
 * que les courses qu'elle n'a pas encore (15 par appel) et les garde ensuite dans le navigateur.
 * « v: 2 » : une entrée gardée sans ce numéro (version précédente, sans tours) est redemandée.
 */
interface StravaDetail {
  id: number
  max_heartrate?: number | null
  best_efforts?: { name: string; elapsed_time: number; pr_rank?: number | null }[]
  splits_metric?: { distance: number; moving_time: number; average_heartrate?: number | null }[]
  laps?: { distance?: number; moving_time?: number; elapsed_time?: number; average_heartrate?: number | null; max_heartrate?: number | null }[]
}

const NAMES: Record<string, string> = { '5k': '5k', '10k': '10k', 'Half-Marathon': 'half', Marathon: 'marathon' }
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0)

export interface RunDetailsV2 {
  v: 2
  efforts: Record<string, number>
  prs: string[]
  splits: number[]
  splitHr: number[]
  laps: { m: number; sec: number; elapsedSec: number; hr: number | null; maxHr: number | null }[]
  maxHr: number | null
}

export default defineEventHandler(async (event) => {
  const body = await readBody<{ ids?: number[] }>(event)
  const ids = (body?.ids ?? []).map(Number).filter(Number.isInteger).slice(0, 15)
  const out: Record<number, RunDetailsV2> = {}

  for (const id of ids) {
    let d: StravaDetail
    try {
      d = await stravaFetch<StravaDetail>(event, `/activities/${id}`)
    } catch (e) {
      // Limite Strava atteinte : on rend ce qu'on a, le reste viendra à la prochaine synchro
      if ((e as { statusCode?: number }).statusCode === 429) break
      continue
    }
    const efforts: Record<string, number> = {}
    const prs: string[] = []
    for (const be of Array.isArray(d.best_efforts) ? d.best_efforts : []) {
      const key = NAMES[be?.name]
      if (!key) continue
      efforts[key] = be.elapsed_time
      if (be.pr_rank === 1) prs.push(key)
    }
    const km = (Array.isArray(d.splits_metric) ? d.splits_metric : []).filter((s) => num(s?.distance) > 950)
    const laps = (Array.isArray(d.laps) ? d.laps : []).slice(0, 80).map((l) => ({
      m: Math.round(num(l?.distance)),
      sec: Math.round(num(l?.moving_time)),
      elapsedSec: Math.round(num(l?.elapsed_time) || num(l?.moving_time)),
      hr: num(l?.average_heartrate) ? Math.round(num(l?.average_heartrate)) : null,
      maxHr: num(l?.max_heartrate) ? Math.round(num(l?.max_heartrate)) : null,
    }))
    out[id] = {
      v: 2,
      efforts,
      prs,
      splits: km.map((s) => Math.round((num(s.moving_time) * 1000) / s.distance)),
      splitHr: km.map((s) => Math.round(num(s.average_heartrate))),
      laps,
      maxHr: num(d.max_heartrate) ? Math.round(num(d.max_heartrate)) : null,
    }
  }
  return out
})
