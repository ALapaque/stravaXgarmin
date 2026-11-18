/** Synchro avec Strava et Garmin à l'ouverture (après le chargement de l'état sauvegardé). */
export default defineNuxtPlugin(() => {
  onNuxtReady(async () => {
    const route = useRoute()
    if (route.query.connecte === 'strava') {
      useToast().show('Strava connecté')
      await navigateTo({ query: {} }, { replace: true })
    }
    const sync = useSync()
    await sync.run()

    // Retour dans l'appli (ex. après avoir fermé le mini-navigateur de connexion Strava sur iPhone) :
    // on revérifie les comptes et on resynchronise, au plus une fois toutes les 20 secondes
    let last = Date.now()
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible' || Date.now() - last < 20_000) return
      last = Date.now()
      sync.run()
    })
  })
})
