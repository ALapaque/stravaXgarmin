/** Sans Strava connecté et sans démo, toutes les pages mènent à la présentation / connexion. */
export default defineNuxtRouteMiddleware((to) => {
  if (to.path.startsWith('/connexion')) return
  const accounts = useState<Accounts | undefined>('accounts')
  const connected = Boolean(accounts.value?.strava?.connected)
  const demo = useCookie<boolean>(DEMO_COOKIE).value === true
  if (!connected && !demo) return navigateTo('/connexion', { replace: true })
})
