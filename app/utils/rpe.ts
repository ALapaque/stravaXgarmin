/*
 * Teinte d'une note de ressenti (1 à 10), du plus facile au plus dur : « --ok », puis l'accent du thème,
 * puis « --ko ». Uniquement des variables des thèmes, mélangées par le navigateur.
 */
export function rpeTint(v: number | null | undefined): string {
  if (!v || v < 1) return 'var(--muted)'
  const n = Math.min(10, Math.max(1, Math.round(v)))
  if (n <= 5) return `color-mix(in oklab, var(--accent-text) ${Math.round(((n - 1) / 4) * 100)}%, var(--ok))`
  return `color-mix(in oklab, var(--ko) ${Math.round(((n - 5) / 5) * 100)}%, var(--accent-text))`
}
