/** Bilan de la semaine écrit par l'IA : ce qui a marché, ce qui fatigue, quoi surveiller. */
export default defineEventHandler(async (event) => {
  const body = await readBody<{ runs?: RunInput[]; previous?: { km?: number; count?: number }; next?: string[]; goal?: string }>(event)
  const runs = (body?.runs ?? []).slice(0, 14)
  if (!runs.length) throw createError({ statusCode: 400, statusMessage: 'Aucune course cette semaine' })

  const context = [
    body?.previous ? `Semaine précédente : ${Number(body.previous.km ?? 0).toFixed(1)} km en ${Number(body.previous.count ?? 0)} courses.` : '',
    body?.goal ? `Objectif : ${String(body.goal).slice(0, 120)}` : '',
    body?.next?.length ? `Séances prévues ensuite : ${body.next.slice(0, 6).map((s) => String(s).slice(0, 80)).join(' ; ')}` : '',
  ].filter(Boolean)

  return aiJson<{ headline: string; wins: string[]; watch: string[]; next: string }>(event, {
    name: 'bilan',
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['headline', 'wins', 'watch', 'next'],
      properties: {
        headline: { type: 'string', description: 'Une phrase qui résume la semaine' },
        wins: { type: 'array', items: { type: 'string' }, description: '2 ou 3 points forts, chiffrés' },
        watch: { type: 'array', items: { type: 'string' }, description: '1 ou 2 points à surveiller' },
        next: { type: 'string', description: 'Un conseil concret pour la semaine suivante' },
      },
    },
    instructions:
      'Tu es un entraîneur de course à pied. Fais le bilan de la semaine en français, en tutoyant, sans flatterie inutile. Appuie-toi uniquement sur les chiffres fournis (volume, allures, fréquence cardiaque, répartition des types de séance, comparaison à la semaine précédente). Phrases courtes. Si une information manque, n’en parle pas.',
    input: `${runs.map((r, i) => `Course ${i + 1}\n${describeRun(r)}`).join('\n\n')}${context.length ? `\n\n${context.join('\n')}` : ''}`,
  })
})
