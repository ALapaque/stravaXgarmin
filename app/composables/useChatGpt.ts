/*
 * IA via la clé API OpenAI de l'utilisateur (payée à l'usage sur platform.openai.com).
 * « Sign in with ChatGPT » n'est ouvert qu'aux applis locales ou approuvées par OpenAI :
 * en attendant, c'est la clé qui débloque les titres et analyses. Rien n'est simulé.
 */
export function useChatGpt() {
  const { accounts } = useAccounts()
  const route = useRoute()
  const available = true
  const connected = computed(() => Boolean(accounts.value.openai?.connected))

  function connect() {
    return navigateTo({ path: '/connexion/openai', query: { retour: route.fullPath } })
  }

  return { available, connected, connect }
}
