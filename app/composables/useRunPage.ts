/*
 * Course ouverte par son adresse (/activites/[id], /activites/[id]/debrief).
 * En mode réel, les courses vivent dans le navigateur : le serveur ne les connaît pas. Une adresse ouverte
 * directement (rechargement, notification du téléphone) attend donc que l'état gardé soit rechargé, puis
 * la fin de la première synchro, avant de conclure qu'une course n'existe pas. Jamais d'erreur 404.
 * En démo, les courses sont connues dès le rendu serveur : pas d'attente.
 */
import type { Activity } from './useActivities'

/** Vrai une fois l'état gardé dans le navigateur rechargé (plugins/persist.client.ts). */
export const useRestored = () => useState('restored', () => false)

export function useRunPage() {
  const route = useRoute()
  const { byId } = useActivities()
  const { synced, syncing } = useSync()
  const restored = useRestored()

  const id = computed(() => String(route.params.id ?? ''))
  const run = computed<Activity | undefined>(() => byId(id.value))
  /** « ready » : la course est là ; « loading » : on ne sait pas encore ; « missing » : elle n'existe vraiment pas */
  const state = computed<'ready' | 'loading' | 'missing'>(() => {
    if (run.value) return 'ready'
    if (!restored.value || !synced.value || syncing.value) return 'loading'
    return 'missing'
  })

  return { id, run, state }
}
