export const THEMES = [
  {
    id: 'vibe',
    label: 'Vibe',
    description: 'Dégradés orange et bleu, aurore en fond',
    bg: '#06070d',
    swatch: ['#ff5a1f', '#ff2e93', '#2b6bff'],
  },
  {
    id: 'neon',
    label: 'Néon',
    description: 'Verre dépoli et grosses typos',
    bg: '#0b0d17',
    swatch: ['#ff5a1f', '#00e0c6', '#ffffff'],
  },
  {
    id: 'oled',
    label: 'OLED',
    description: 'Noir profond, accent orange',
    bg: '#07090d',
    swatch: ['#07090d', '#ff6b2c', '#12161e'],
  },
  {
    id: 'calme',
    label: 'Calme',
    description: 'Sobre, accent bleu ciel',
    bg: '#0a0d14',
    swatch: ['#0a0d14', '#5ab9fc', '#131824'],
  },
] as const

export type ThemeId = (typeof THEMES)[number]['id']

const isTheme = (value: unknown): value is ThemeId => THEMES.some((t) => t.id === value)

/** Thème courant, gardé dans un cookie pour être appliqué dès le rendu serveur. */
export function useTheme() {
  const cookie = useCookie<string>('stravaxgarmin-theme', {
    default: () => 'vibe',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  })

  const theme = computed<ThemeId>({
    get: () => (isTheme(cookie.value) ? cookie.value : 'vibe'),
    set: (value) => {
      cookie.value = value
    },
  })

  const current = computed(() => THEMES.find((t) => t.id === theme.value)!)

  return { theme, current, themes: THEMES }
}
