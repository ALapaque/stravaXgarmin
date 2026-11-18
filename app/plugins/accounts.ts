/**
 * Comptes connectés connus dès le rendu serveur (cookies transmis),
 * pour ne pas afficher l'accueil « non connecté » à quelqu'un qui l'est.
 */
export default defineNuxtPlugin(async () => {
  const accounts = useState<Accounts>('accounts')
  if (accounts.value?.loaded) return
  try {
    const me = await useRequestFetch()<Omit<Accounts, 'loaded'>>('/api/me')
    accounts.value = { loaded: true, ...me }
  } catch {
    // Variables d'environnement absentes : on restera sur l'accueil non connecté
  }
})
