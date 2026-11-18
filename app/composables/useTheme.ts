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

/*
 * Réglages sur mesure, posés par-dessus le thème choisi : couleur d'accent, arrondis,
 * police et intensité du fond animé. Gardés dans un cookie, comme le thème, pour être
 * appliqués dès le rendu serveur (pas de flash au chargement).
 */
export interface CustomLook {
  accent: string | null
  accent2: string | null
  radius: 'theme' | 'sharp' | 'soft' | 'round'
  font: 'theme' | keyof typeof FONTS
  /** Intensité du fond animé de 0 à 100, ou null pour celle du thème */
  aurora: number | null
}

export const DEFAULT_LOOK: CustomLook = { accent: null, accent2: null, radius: 'theme', font: 'theme', aurora: null }

export const FONTS = {
  inter: { label: 'Inter', display: "'Inter'", body: "'Inter'" },
  grotesk: { label: 'Space Grotesk', display: "'Space Grotesk'", body: "'Space Grotesk'" },
  sora: { label: 'Sora', display: "'Sora'", body: "'Sora'" },
  fraunces: { label: 'Fraunces', display: "'Fraunces'", body: "'Inter'" },
  unbounded: { label: 'Unbounded', display: "'Unbounded'", body: "'Inter'" },
  barlow: { label: 'Barlow Condensed', display: "'Barlow Condensed'", body: "'Barlow'" },
} as const

export const RADII = {
  sharp: { label: 'Vifs', card: '4px', btn: '2px', ctrl: '2px', tab: '6px', pill: '2px', knob: '2px' },
  soft: { label: 'Doux', card: '16px', btn: '12px', ctrl: '10px', tab: '20px', pill: '10px', knob: '8px' },
  round: { label: 'Ronds', card: '30px', btn: '999px', ctrl: '16px', tab: '999px', pill: '999px', knob: '50%' },
} as const

const HEX = /^#[0-9a-f]{6}$/i

/** Noir ou blanc, selon ce qui se lit le mieux sur la couleur donnée. */
function contrast(hex: string) {
  const n = Number.parseInt(hex.slice(1), 16)
  const lin = (c: number) => {
    const v = c / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  const lum = 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255)
  return lum > 0.4 ? '#0a0a0a' : '#ffffff'
}

/** Variables CSS à poser sur <html> pour ces réglages. */
export function lookStyle(look: CustomLook, theme: ThemeId) {
  const v: Record<string, string> = {}
  const a = look.accent && HEX.test(look.accent) ? look.accent : null
  if (a) {
    const b = look.accent2 && HEX.test(look.accent2) ? look.accent2 : null
    const fill = b ? `linear-gradient(120deg, ${a}, ${b})` : a
    const on = contrast(a)
    Object.assign(v, {
      '--primary': fill,
      '--primary-solid': a,
      '--on-primary': on,
      '--select': fill,
      '--on-select': on,
      '--tab-active': fill,
      '--on-tab-active': on,
      '--focus': a,
      '--link': a,
      // Sur le thème clair, la couleur est assombrie pour rester lisible en texte
      '--accent-text': theme === 'papier' ? `color-mix(in srgb, ${a} 72%, #000)` : a,
      '--aurora-1': a,
      '--aurora-2': b ?? a,
    })
    if (theme !== 'carbone') v['--primary-shadow'] = `0 14px 34px -8px color-mix(in srgb, ${a} 60%, transparent)`
  }
  if (look.radius !== 'theme' && look.radius in RADII) {
    const r = RADII[look.radius]
    Object.assign(v, { '--r-card': r.card, '--r-btn': r.btn, '--r-ctrl': r.ctrl, '--r-tab': r.tab, '--r-pill': r.pill, '--r-knob': r.knob })
  }
  if (look.font !== 'theme' && look.font in FONTS) {
    const f = FONTS[look.font]
    v['--font-display'] = `${f.display}, system-ui, sans-serif`
    v['--font-body'] = `${f.body}, system-ui, sans-serif`
  }
  if (typeof look.aurora === 'number') v['--aurora-strength'] = String(Math.min(Math.max(look.aurora, 0), 100) / 100)
  return Object.entries(v)
    .map(([k, val]) => `${k}:${val}`)
    .join(';')
}

/** Thème courant, gardé dans un cookie pour être appliqué dès le rendu serveur. */
export function useTheme() {
  const cookie = useCookie<string>('stravaxgarmin-theme', {
    default: () => 'neon',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  })
  const lookCookie = useCookie<Partial<CustomLook> | null>('stravaxgarmin-look', {
    default: () => null,
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  })

  const theme = computed<ThemeId>({
    get: () => (isTheme(cookie.value) ? cookie.value : 'neon'),
    set: (value) => {
      cookie.value = value
    },
  })

  const look = computed<CustomLook>({
    get: () => ({ ...DEFAULT_LOOK, ...(lookCookie.value && typeof lookCookie.value === 'object' ? lookCookie.value : {}) }),
    set: (value) => {
      lookCookie.value = value
    },
  })
  const customized = computed(() => JSON.stringify(look.value) !== JSON.stringify(DEFAULT_LOOK))
  const style = computed(() => lookStyle(look.value, theme.value))

  const current = computed(() => THEMES.find((t) => t.id === theme.value)!)

  return { theme, current, themes: THEMES, look, customized, style }
}
