/*
 * Anciennes adresses de l'appli (cinq onglets) et leur place dans la nouvelle organisation (trois onglets).
 * Logique pure, testée (tests/nav.test.ts). Sert aux pages de redirection (côté serveur et navigateur).
 */

export interface Target {
  path: string
  query: Record<string, string>
}

/** Rubriques de l'ancien écran Stats → rubriques de Progression. */
export const STATS_TABS: Record<string, string> = {
  forme: 'forme',
  records: 'records',
  // L'estimation par l'IA vit encore dans sa propre rubrique de Progression (elle rejoindra Forme)
  ia: 'niveau',
  niveau: 'niveau',
  shoes: 'materiel',
  chaussures: 'materiel',
}

const one = (v: unknown) => (Array.isArray(v) ? v[0] : v)

/**
 * Nouvelle adresse d'une ancienne, ou null si l'adresse n'a pas bougé.
 * Les autres paramètres de l'adresse sont gardés ; une rubrique inconnue est oubliée.
 */
export function legacyRedirect(path: string, query: Record<string, unknown> = {}): Target | null {
  const p = path.replace(/\/+$/, '') || '/'
  const rest: Record<string, string> = {}
  for (const [k, v] of Object.entries(query)) {
    const s = one(v)
    if (k !== 'onglet' && typeof s === 'string') rest[k] = s
  }
  const tab = one(query.onglet)

  if (p === '/activites') return { path: '/journal', query: rest }
  if (p === '/plan') return { path: '/journal', query: { ...rest, onglet: 'a-venir' } }
  if (p === '/stats') {
    const mapped = typeof tab === 'string' ? STATS_TABS[tab] : undefined
    // « forme » est la rubrique par défaut : pas besoin de l'écrire dans l'adresse
    return { path: '/progression', query: mapped && mapped !== 'forme' ? { ...rest, onglet: mapped } : rest }
  }
  return null
}

/**
 * Retour depuis la page d'une course : l'écran d'où l'on vient (adresse précédente de l'historique du
 * navigateur, rubrique comprise), s'il fait partie des onglets ; sinon le Journal.
 */
export function backTarget(previous: unknown): { to: string; label: string } {
  const prev = typeof previous === 'string' && previous.startsWith('/') && !previous.startsWith('//') ? previous : ''
  const path = prev.split(/[?#]/)[0]!
  if (path === '/') return { to: '/', label: 'Aujourd’hui' }
  if (path === '/journal') return { to: prev, label: 'Journal' }
  if (path === '/progression' || path === '/bilan' || path === '/recap') return { to: prev, label: 'Progression' }
  if (path === '/notifications') return { to: prev, label: 'Notifications' }
  return { to: '/journal', label: 'Journal' }
}
