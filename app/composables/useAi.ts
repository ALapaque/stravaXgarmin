/*
 * Réponses IA simulées. À remplacer par une route serveur qui appelle l'API
 * OpenAI avec le compte ChatGPT de l'utilisateur (« Sign in with ChatGPT »).
 */
import type { Activity } from './useActivities'

export type TitleStyle = 'sobre' | 'drole' | 'epique'

export const TITLE_STYLES: { id: TitleStyle; label: string }[] = [
  { id: 'sobre', label: 'Sobre' },
  { id: 'drole', label: 'Drôle' },
  { id: 'epique', label: 'Épique' },
]

const IDEAS: Record<Activity['type'], Record<TitleStyle, string[]>> = {
  interval: {
    sobre: ['Fractionné 10×400 à {pace} /km', '10×400 sur piste', 'Séance de VMA courte'],
    drole: ['Le tartan s’en souvient encore', 'Tourner en rond, mais vite', 'Mes mollets demandent un avocat'],
    epique: ['Dix fois 400, zéro regret', 'La piste a parlé', 'Dix assauts, dix victoires'],
  },
  long: {
    sobre: ['Sortie longue de {km} km', 'Endurance fondamentale', '{km} km au calme'],
    drole: ['Le café était loin', 'J’ai vu trois villages et un chien', 'Podcast terminé, jambes aussi'],
    epique: ['{km} kilomètres d’horizon', 'La longue route du dimanche', 'Plus loin que prévu'],
  },
  recovery: {
    sobre: ['Footing de récupération', 'Récup tranquille, {km} km', 'Jambes déliées'],
    drole: ['Le canapé m’a laissé sortir', 'Allure escargot assumée', 'Courir sans transpirer, presque'],
    epique: ['Le repos du guerrier', 'Recharger avant la tempête', 'Calme avant la prochaine bataille'],
  },
  tempo: {
    sobre: ['Tempo {km} km à {pace} /km', 'Allure seuil tenue', 'Tempo sur route'],
    drole: ['{km} km, zéro excuse', 'Le chrono n’a pas rigolé', 'Pressé, mais pour rien'],
    epique: ['Sur le fil du seuil', 'Cinq kilomètres de feu', 'Le rythme ne pliera pas'],
  },
}

const fill = (s: string, a: Activity) =>
  s.replace('{km}', formatKm(a.distanceKm)).replace('{pace}', formatPace(a.durationSec, a.distanceKm))

export function useAi() {
  async function suggestTitles(a: Activity, style: TitleStyle, round = 0): Promise<string[]> {
    await new Promise((r) => setTimeout(r, 450))
    const list = IDEAS[a.type][style].map((s) => fill(s, a))
    const shift = round % list.length
    return [...list.slice(shift), ...list.slice(0, shift)]
  }

  async function analyse(a: Activity) {
    await new Promise((r) => setTimeout(r, 600))
    return {
      score: 92,
      verdict: 'Ta séance piste la plus régulière depuis septembre.',
      findings: [
        { kind: 'ok' as const, title: 'Allure stable', text: 'Tes 400 m restent entre 5:12 et 5:24 /km.' },
        { kind: 'ko' as const, title: 'Dérive cardiaque', text: `+6 bpm sur les trois dernières répétitions (moyenne ${a.avgHr} bpm).` },
        { kind: 'tip' as const, title: 'Pour la prochaine fois', text: 'Passe la récup à 90 s pour tenir le rythme.' },
      ],
    }
  }

  async function estimateLevel(selected: Activity[]) {
    await new Promise((r) => setTimeout(r, 900))
    return { vma: 16.2, vo2max: 52, threshold: '4:38', half: '1:42', count: selected.length }
  }

  return { suggestTitles, analyse, estimateLevel }
}
