/** Sans Strava connecté et sans démo, toutes les pages mènent à la présentation. */
export default defineNuxtRouteMiddleware((to) => {
  if (to.path.startsWith('/connexion')) return
  const accounts = useState<Accounts | undefined>('accounts')
  const connected = Boolean(accounts.value?.strava?.connected)
  const demo = useCookie<boolean>(DEMO_COOKIE).value === true

  // « / » affiche lui-même la présentation, sans redirection : sur iPhone, une app installée
  // dont la page de départ redirige s'ouvre avec la barre du navigateur
  if (to.path === '/') {
    setPageLayout(!connected && !demo ? 'bare' : 'default')
    return
  }
  if (!connected && !demo) return navigateTo('/', { replace: true })
})
