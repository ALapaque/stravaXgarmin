/*
 * Teintes du profil des tours, partagées par le graphique de la page (LapProfile) et l'image à partager
 * (shareImage) : toujours des variables des thèmes, jamais une couleur en dur.
 */
import type { LegendKey } from '#shared/utils/runchart'

/** Séance reliée : une teinte par nature d'étape */
export const LAP_KIND_COLORS: Record<string, string> = {
  warmup: 'var(--info)',
  cooldown: 'var(--info)',
  interval: 'var(--accent-text)',
  recovery: 'var(--ok)',
  rest: 'var(--muted)',
  other: 'var(--type-long)',
}

/** Étape sans nature connue (« Hors séance ») */
export const LAP_NO_KIND_COLOR = 'var(--muted)'

/** Sans séance reliée : une seule teinte (celle du type de course), de plus en plus franche avec la vitesse */
export const LAP_TIER_MIX = [38, 58, 78, 100]

/** Pastilles de la légende (« missed » n'a pas de teinte : un fantôme hachuré) */
export const LAP_LEGEND_COLORS: Record<Exclude<LegendKey, 'missed'>, string> = {
  calm: LAP_KIND_COLORS.warmup!,
  interval: LAP_KIND_COLORS.interval!,
  recovery: LAP_KIND_COLORS.recovery!,
  other: LAP_KIND_COLORS.other!,
  none: LAP_NO_KIND_COLOR,
  partial: 'var(--accent-text)',
}
