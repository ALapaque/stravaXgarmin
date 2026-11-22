/** Les cinq types de séance reconnus par l'appli, et leur nom affiché. */
export type RunType = 'long' | 'easy' | 'interval' | 'recovery' | 'tempo'

export const RUN_LABELS: Record<RunType, string> = {
  long: 'Sortie longue',
  easy: 'Footing',
  interval: 'Fractionné',
  recovery: 'Récupération',
  tempo: 'Tempo',
}
