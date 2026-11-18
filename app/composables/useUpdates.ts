/*
 * Mises à jour et notes de version.
 * - « update » : une nouvelle version est déployée pendant que l'appli est ouverte
 *   (nouveau service worker en attente) → popup avec ses notes et un bouton pour l'installer.
 * - « whatsnew » : première ouverture après une mise à jour → ce qui a changé depuis ta dernière visite.
 * - « history » : tout le changelog, ouvert depuis les réglages.
 */
export interface Release {
  version: string
  date: string
  sections: { title: string; items: string[] }[]
}

const SEEN_KEY = 'sxg:lastSeenVersion'

function newer(a: string, b: string) {
  const pa = a.split(/[.-]/).map(Number)
  const pb = b.split(/[.-]/).map(Number)
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) > (pb[i] ?? 0)
  }
  return false
}

export function useUpdates() {
  const open = useState('upd-open', () => false)
  const mode = useState<'update' | 'whatsnew' | 'history'>('upd-mode', () => 'whatsnew')
  const releases = useState<Release[]>('upd-releases', () => [])
  const target = useState('upd-target', () => '')
  const current = String(useRuntimeConfig().public.version ?? '0.0.0')

  async function fetchChangelog() {
    // Pas de cache : après un déploiement, c'est la nouvelle version qui répond
    return $fetch<{ version: string; releases: Release[] }>('/api/changelog', { query: { t: Date.now() } })
  }

  function seen(version: string) {
    try {
      localStorage.setItem(SEEN_KEY, version)
    } catch {
      /* stockage indisponible */
    }
  }

  /** Au démarrage : affiche ce qui a changé depuis la dernière version vue. */
  async function checkWhatsNew() {
    if (current === '0.0.0') return
    let last: string | null = null
    try {
      last = localStorage.getItem(SEEN_KEY)
    } catch {
      return
    }
    if (!last) return seen(current) // première visite : rien à annoncer
    if (!newer(current, last)) return
    const { releases: all } = await fetchChangelog()
    const fresh = all.filter((r) => newer(r.version, last!) && !newer(r.version, current))
    seen(current)
    if (!fresh.length) return
    releases.value = fresh
    target.value = current
    mode.value = 'whatsnew'
    open.value = true
  }

  /** Une nouvelle version attend dans le service worker. */
  async function announceUpdate() {
    try {
      const { version, releases: all } = await fetchChangelog()
      releases.value = all.filter((r) => newer(r.version, current)).slice(0, 3)
      target.value = version
    } catch {
      releases.value = []
      target.value = ''
    }
    mode.value = 'update'
    open.value = true
  }

  async function installUpdate() {
    if (target.value) seen(target.value) // ses notes viennent d'être lues : pas de second « Quoi de neuf »
    const pwa = useNuxtApp().$pwa as { updateServiceWorker?: (reload?: boolean) => Promise<void> } | undefined
    if (pwa?.updateServiceWorker) await pwa.updateServiceWorker(true)
    else window.location.reload()
  }

  async function showHistory() {
    const { releases: all } = await fetchChangelog()
    releases.value = all
    target.value = current
    mode.value = 'history'
    open.value = true
  }

  return { open, mode, releases, target, current, checkWhatsNew, announceUpdate, installUpdate, showHistory }
}
