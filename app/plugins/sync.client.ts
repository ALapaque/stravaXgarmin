/** Synchro avec Strava et Garmin à l'ouverture (après le chargement de l'état sauvegardé). */
export default defineNuxtPlugin(() => {
  onNuxtReady(async () => {
    const route = useRoute()
    if (route.query.connecte === 'strava') {
      useToast().show('Strava connecté')
      await navigateTo({ query: {} }, { replace: true })
    }
    await useSync().run()
  })
})
