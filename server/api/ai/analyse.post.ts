/** Analyse d'une séance : score de régularité, verdict et trois constats. */
export default defineEventHandler(async (event) => {
  const body = await readBody<{ run?: RunInput }>(event)
  if (!body?.run) throw createError({ statusCode: 400, statusMessage: 'Course manquante' })
  const details = await stravaDetails(event, body.run.stravaId)

  return openAiJson<{ score: number; verdict: string; findings: { kind: 'ok' | 'ko' | 'tip'; title: string; text: string }[] }>(event, {
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
    instructions:
      'Tu es un entraîneur de course à pied. Analyse la séance en français, en tutoyant. Donne un score de régularité de 0 à 100, un verdict d’une phrase, puis exactement 3 constats : un point fort (ok), un point à surveiller (ko) et un conseil pour la prochaine fois (tip). Titres de 3 mots maximum, textes d’une ou deux phrases, chiffrés à partir des données. N’invente aucune donnée absente ; si une info manque (pas de FC par exemple), n’en parle pas.',
    input: describeRun(body.run, details),
  })
})
