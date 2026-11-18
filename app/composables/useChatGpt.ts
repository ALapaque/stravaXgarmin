/*
 * IA avec la clé de l'utilisateur : Gemini ou Mistral (gratuits) ou OpenAI (payant à l'usage).
 * « Sign in with ChatGPT » n'est ouvert qu'aux applis locales ou approuvées par OpenAI ;
 * en attendant, c'est la clé qui débloque les titres et analyses. Rien n'est simulé.
 */
export function useChatGpt() {
  const { accounts } = useAccounts()
  const route = useRoute()
  const available = true
  const connected = computed(() => Boolean(accounts.value.ai?.connected))
  const label = computed(() => accounts.value.ai?.name?.split(' · ')[0] ?? 'IA')

  function connect() {
    return navigateTo({ path: '/connexion/ia', query: { retour: route.fullPath } })
  }

  return { available, connected, label, connect }
}
