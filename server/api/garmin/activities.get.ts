/** 60 dernières activités Garmin (nom, début, distance) pour les relier à Strava. */
export default defineEventHandler(async (event) => {
  const gc = await garminClient(event)
  const list = await garminCall(() => gc.getActivities(0, 60))
  return list.map((a) => ({
    id: a.activityId,
    name: a.activityName,
    startTimeGMT: a.startTimeGMT,
    distance: a.distance,
    type: a.activityType?.typeKey,
  }))
})
