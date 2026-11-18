/** Chaussures utilisées dans les courses : nom et kilométrage total tenus par Strava. */
interface StravaGear {
  id: string
  name?: string
  brand_name?: string
  model_name?: string
  distance?: number
  primary?: boolean
  retired?: boolean
}

export default defineEventHandler(async (event) => {
  const body = await readBody<{ ids?: string[] }>(event)
  const ids = [...new Set((body?.ids ?? []).map(String).filter((id) => /^g\d+$/.test(id)))].slice(0, 10)
  const out: { id: string; name: string; km: number; primary: boolean; retired: boolean }[] = []
  for (const id of ids) {
    try {
      const g = await stravaFetch<StravaGear>(event, `/gear/${id}`)
      out.push({
        id: g.id,
        name: g.name || [g.brand_name, g.model_name].filter(Boolean).join(' ') || 'Chaussures',
        km: Math.round((g.distance ?? 0) / 1000),
        primary: Boolean(g.primary),
        retired: Boolean(g.retired),
      })
    } catch (e) {
      if ((e as { statusCode?: number }).statusCode === 429) break
    }
  }
  return out
})
