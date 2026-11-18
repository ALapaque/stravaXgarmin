/*
 * Connexion ChatGPT : pas encore branchée.
 * « Sign in with ChatGPT » est en essai limité chez OpenAI (identifiant client à demander),
 * et seuls les abonnements Plus et Pro peuvent utiliser leur quota dans une appli tierce.
 * Tant que ce n'est pas fait, aucune fonction IA n'est proposée : rien n'est simulé.
 */
export function useChatGpt() {
  const { show } = useToast()
  const available = false
  const connected = computed(() => false)

  function connect() {
    show('Connexion ChatGPT bientôt disponible')
  }

  return { available, connected, connect }
}
