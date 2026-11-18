import type { StravaActivity } from '../../utils/strava'

const RUNS = new Set(['Run', 'TrailRun', 'VirtualRun'])

/** Courses Strava des 60 derniers jours. */
export default defineEventHandler(async (event) => {
  const after = Math.floor(Date.now() / 1000) - 60 * 24 * 3600
  const list = await stravaFetch<StravaActivity[]>(event, '/athlete/activities', { query: { after, per_page: 100 } })
  return list.filter((a) => RUNS.has(a.sport_type))
})
