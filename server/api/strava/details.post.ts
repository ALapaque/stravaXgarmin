/*
 * Détail de quelques courses Strava : meilleurs efforts (avec record ou non) et temps au km.
 * Strava limite les appels (100 par quart d'heure) : l'appli ne demande que les courses
 * qu'elle n'a pas encore et les garde ensuite dans le navigateur.
 */
interface StravaDetail {
  id: number
  best_efforts?: { name: string; elapsed_time: number; pr_rank?: number | null }[]
  splits_metric?: { distance: number; moving_time: number }[]
}

const NAMES: Record<string, string> = { '5k': '5k', '10k': '10k', 'Half-Marathon': 'half', Marathon: 'marathon' }

export default defineEventHandler(async (event) => {
  const body = await readBody<{ ids?: number[] }>(event)
  const ids = (body?.ids ?? []).map(Number).filter(Number.isInteger).slice(0, 15)
  const out: Record<number, { efforts: Record<string, number>; prs: string[]; splits: number[] }> = {}

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
    for (const be of d.best_efforts ?? []) {
      const key = NAMES[be.name]
      if (!key) continue
      efforts[key] = be.elapsed_time
      if (be.pr_rank === 1) prs.push(key)
    }
    const splits = (d.splits_metric ?? []).filter((s) => s.distance > 950).map((s) => Math.round((s.moving_time * 1000) / s.distance))
    out[id] = { efforts, prs, splits }
  }
  return out
})
