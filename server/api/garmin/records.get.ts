/*
 * Records personnels tenus par Garmin Connect (API non officielle) :
 * 1 km, mile, 5 km, 10 km, semi, marathon, course la plus longue.
 */
const API = 'https://connectapi.garmin.com/personalrecord-service'

interface GarminPr {
  typeId: number
  value: number
  activityId?: number
  activityName?: string
  activityType?: string
  prStartTimeGmtFormatted?: string
  actStartDateTimeInGMTFormatted?: string
  prStartTimeGmt?: number
}

interface GarminPrType {
  id: number
  key?: string
  sport?: string
}

/** Correspondance de secours si la liste des types n'est pas lisible (valeurs observées chez Garmin) */
const FALLBACK: Record<number, string> = { 1: '1k', 2: 'mile', 3: '5k', 4: '10k', 5: 'half', 6: 'marathon', 7: 'longest' }

function keyOf(type: GarminPrType | undefined, typeId: number) {
  const k = (type?.key ?? '').toLowerCase()
  if (k) {
    if (/half/.test(k)) return 'half'
    if (/marathon/.test(k)) return 'marathon'
    if (/10k|10\.?km/.test(k)) return '10k'
    if (/5k|5\.?km/.test(k)) return '5k'
    if (/1k|1\.?km/.test(k)) return '1k'
    if (/mile/.test(k)) return 'mile'
    if (/farthest|longest/.test(k) && /run/.test(k)) return 'longest'
    return undefined
  }
  return FALLBACK[typeId]
}

export default defineEventHandler(async (event) => {
  const gc = await garminClient(event)
  const profile = await garminCall(() => gc.getUserProfile() as Promise<{ displayName?: string }>)
  if (!profile.displayName) throw createError({ statusCode: 502, statusMessage: 'Profil Garmin illisible' })

  const [prs, types] = await Promise.all([
    garminCall(() => gc.get<GarminPr[]>(`${API}/personalrecord/prs/${encodeURIComponent(profile.displayName!)}`)),
    gc.get<GarminPrType[]>(`${API}/personalrecordtype/prtypes/${encodeURIComponent(profile.displayName!)}`).catch(() => [] as GarminPrType[]),
  ])
  const typeById = new Map((Array.isArray(types) ? types : []).map((t) => [t.id, t]))
  if (!typeById.size) console.warn('[garmin] types de records illisibles, correspondance de secours utilisée')

  const out: { key: string; value: number; activityId?: number; activityName?: string; date?: string }[] = []
  for (const pr of Array.isArray(prs) ? prs : []) {
    const type = typeById.get(pr.typeId)
    if (type?.sport && !/run/i.test(type.sport)) continue
    const key = keyOf(type, pr.typeId)
    if (!key || out.some((o) => o.key === key)) continue
    out.push({
      key,
      value: pr.value,
      activityId: pr.activityId,
      activityName: pr.activityName,
      date: pr.actStartDateTimeInGMTFormatted ?? pr.prStartTimeGmtFormatted ?? (pr.prStartTimeGmt ? new Date(pr.prStartTimeGmt).toISOString() : undefined),
    })
  }
  return out
})
