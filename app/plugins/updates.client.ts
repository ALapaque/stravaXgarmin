/** Surveille les nouvelles versions et annonce les nouveautés après une mise à jour. */
export default defineNuxtPlugin(() => {
  onNuxtReady(() => {
    const updates = useUpdates()
    updates.checkWhatsNew().catch(() => {})

    const pwa = useNuxtApp().$pwa as { needRefresh?: Ref<boolean> | boolean } | undefined
    if (!pwa) return
    watch(
      () => (isRef(pwa.needRefresh) ? pwa.needRefresh.value : pwa.needRefresh),
      (waiting) => {
        if (waiting) updates.announceUpdate()
      },
      { immediate: true },
    )
  })
})
