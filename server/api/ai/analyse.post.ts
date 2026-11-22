/**
 * Analyse d'une séance : score de régularité, verdict et trois constats au plus.
 * Le Débrief envoie aussi la séance prévue (« plan ») et le ressenti (« feeling ») ; la note du coureur
 * n'y est que s'il l'a permis (réglage ai.shareNote, appliqué dans le navigateur).
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<{ run?: RunInput; plan?: unknown; feeling?: unknown }>(event)
  if (!body?.run) throw createError({ statusCode: 400, statusMessage: 'Course manquante' })
  const details = await stravaDetails(event, body.run.stravaId)

  return aiJson<{ score: number; verdict: string; findings: { kind: 'ok' | 'ko' | 'tip'; title: string; text: string }[] }>(event, {
    name: 'analyse',
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['score', 'verdict', 'findings'],
      properties: {
        score: { type: 'integer', description: 'Régularité de la séance sur 100' },
        verdict: { type: 'string' },
        findings: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['kind', 'title', 'text'],
            properties: {
              kind: { type: 'string', enum: ['ok', 'ko', 'tip'] },
              title: { type: 'string' },
              text: { type: 'string' },
            },
          },
        },
      },
    },
    instructions: [
      'Tu es un entraîneur de course à pied. Analyse la séance en français, en tutoyant, de façon concrète et bienveillante.',
      'Quand une séance prévue est donnée, juge la séance par rapport à ce qui était prévu (les étapes, leur nombre, leur durée ou leur distance), pas par rapport à un idéal de vitesse.',
      'Une séance sur tapis n’a pas de GPS : ne commente ni le parcours ni le dénivelé.',
      'Donne un score de régularité de 0 à 100, un verdict d’une phrase, puis 3 constats au plus parmi : un point fort (ok), un point à surveiller (ko), un conseil pour la prochaine fois (tip).',
      'Titres de 3 mots maximum, textes d’une ou deux phrases, chiffrés à partir des données. N’invente aucune donnée absente ; si une info manque (pas de FC par exemple), n’en parle pas.',
      'Tiens compte du ressenti du coureur quand il est donné.',
      'Aucun diagnostic médical : si la note parle d’une douleur ou d’une gêne, conseille seulement de lever le pied et de consulter si elle dure.',
    ].join(' '),
    input: describeRun(body.run, details, { plan: body.plan, feeling: body.feeling }),
  })
})
