/*
 * Sous-menu d'un écran, affiché sur la deuxième face de la barre du bas.
 * La page déclare ses rubriques ; la barre pivote pour les montrer, et un bouton
 * la fait pivoter à nouveau vers le menu principal. La rubrique courante vit dans
 * l'adresse (?onglet=…), donc la barre n'a qu'à changer l'adresse.
 */
export interface SubnavItem {
  id: string
  label: string
  /** Nom de l'icône, résolu par la barre (l'état partagé ne peut contenir que des données) */
  icon: string
  /** Point d'attention : quelque chose à faire dans cette rubrique */
  dot?: boolean
}

export interface Subnav {
  key: string
  label: string
  items: SubnavItem[]
  current: string
}

export const useSubnavState = () => useState<Subnav | null>('subnav', () => null)

export function useSubnav(key: string, label: string, items: MaybeRefOrGetter<SubnavItem[]>, tab: Ref<string>) {
  const state = useSubnavState()
  const sync = () => {
    state.value = { key, label, items: toValue(items), current: tab.value }
  }
  sync()
  watch([tab, () => toValue(items)], sync, { deep: true })
  onBeforeUnmount(() => {
    if (state.value?.key === key) state.value = null
  })
}
