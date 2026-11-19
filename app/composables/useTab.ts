/*
 * Onglet courant d'un écran, gardé dans l'adresse (?onglet=…) : le bouton retour et le
 * rechargement retombent sur le bon onglet, et un lien peut ouvrir un onglet précis.
 */
export function useTab<T extends string>(ids: readonly T[], fallback: T) {
  const route = useRoute()
  const router = useRouter()
  const tab = computed<T>({
    get: () => {
      const q = String(route.query.onglet ?? '')
      return (ids as readonly string[]).includes(q) ? (q as T) : fallback
    },
    set: (id) => {
      router.replace({ query: { ...route.query, onglet: id === fallback ? undefined : id } })
    },
  })
  // Sens du glissement du contenu : vers la gauche quand on avance, vers la droite quand on recule
  const direction = ref<'next' | 'prev'>('next')
  watch(tab, (now, before) => {
    direction.value = ids.indexOf(now) >= ids.indexOf(before) ? 'next' : 'prev'
  }, { flush: 'sync' })
  return { tab, direction }
}
