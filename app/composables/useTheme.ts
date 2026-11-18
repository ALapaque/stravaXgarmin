export const THEMES = [
  { id: 'neon', label: 'Néon', description: 'Verre dépoli, halos orange et cyan', bg: '#0b0d17', swatch: ['#ff5a1f', '#00e0c6', '#ffffff'] },
  { id: 'carbone', label: 'Carbone', description: 'Brut, angles vifs, vert acide', bg: '#0a0a0a', swatch: ['#0a0a0a', '#d4ff3a', '#f5f5f0'] },
  { id: 'papier', label: 'Papier', description: 'Clair, crème et terre cuite', bg: '#f4efe6', swatch: ['#f4efe6', '#d9573a', '#1d1a16'] },
  { id: 'abysse', label: 'Abysse', description: 'Océan profond, tout en rondeurs', bg: '#03141c', swatch: ['#00c2ff', '#00ffc3', '#1452ff'] },
  { id: 'retro', label: 'Rétro 84', description: 'Synthwave, néons rose et cyan', bg: '#120a1f', swatch: ['#ff2a6d', '#ff9e2c', '#05d9e8'] },
  { id: 'trail', label: 'Trail', description: 'Forêt et ambre, typo condensée', bg: '#0d1410', swatch: ['#0d1410', '#e8a33d', '#8fd16a'] },
] as const

export type ThemeId = (typeof THEMES)[number]['id']

const isTheme = (value: unknown): value is ThemeId => THEMES.some((t) => t.id === value)

/** Thème courant, gardé dans un cookie pour être appliqué dès le rendu serveur. */
export function useTheme() {
  const cookie = useCookie<string>('stravaxgarmin-theme', {
    default: () => 'neon',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  })

  const theme = computed<ThemeId>({
    get: () => (isTheme(cookie.value) ? cookie.value : 'neon'),
    set: (value) => {
      cookie.value = value
    },
  })

  const current = computed(() => THEMES.find((t) => t.id === theme.value)!)

  return { theme, current, themes: THEMES }
}
