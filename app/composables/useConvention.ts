/*
 * Convention de titres « [SOURCE] - Titre » : active ou non, sources proposées, étiquette d'échec.
 * Règles dans shared/utils/titles.ts ; réglage « tags » dans useSettings.
 */
export function useConvention() {
  const settings = useSettings()
  const { activities } = useActivities()

  const failTag = computed(() => (settings.value.tags?.fail || 'FAIL').trim().toUpperCase())
  const detected = computed(() => detectConvention(activities.value.map((a) => a.stravaName), failTag.value))

  /** Toujours (« on »), ou en automatique quand tes titres Strava chargés la suivent déjà */
  const enabled = computed(() => {
    const mode = settings.value.tags?.mode ?? 'auto'
    return mode === 'on' || (mode === 'auto' && detected.value.enabled)
  })

  /** Sources : celles du réglage, puis celles vues dans tes titres, puis CUSTOM et RACE ; sans doublon */
  const sources = computed(() => {
    const all = [...(settings.value.tags?.sources ?? []), ...detected.value.sources, 'CUSTOM', 'RACE']
      .map((s) => String(s).replace(/[[\]]/g, '').trim().toUpperCase())
      .filter((s) => s && s !== failTag.value)
    return [...new Set(all)]
  })

  return { enabled, sources, failTag, detected }
}
