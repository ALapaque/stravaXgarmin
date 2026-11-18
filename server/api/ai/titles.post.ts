/** Trois idées de titre pour une course, dans le style demandé. */
const STYLES: Record<string, string> = {
  sobre: 'sobres et factuels (type de séance, distance ou allure)',
  drole: 'drôles, avec de l’autodérision, sans vulgarité',
  epique: 'épiques et inspirants, comme un titre de film',
}

export default defineEventHandler(async (event) => {
  const body = await readBody<{ run?: RunInput; style?: string; avoid?: string[] }>(event)
  if (!body?.run) throw createError({ statusCode: 400, statusMessage: 'Course manquante' })
  const style = STYLES[body.style ?? ''] ?? STYLES.sobre
  const avoid = (body.avoid ?? []).slice(0, 30).map((t) => String(t).slice(0, 100))
  const details = await stravaDetails(event, body.run.stravaId)

  const { titles } = await openAiJson<{ titles: string[] }>(event, {
    name: 'titres',
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['titles'],
      properties: { titles: { type: 'array', items: { type: 'string' } } },
    },
    instructions: `Tu proposes des titres d'activité Strava en français pour un coureur. Donne exactement 3 titres ${style}. Chaque titre fait au plus 60 caractères, sans guillemets, sans hashtag, au plus un emoji. Appuie-toi sur les vraies données de la course et ne les invente pas.`,
    input: `${describeRun(body.run, details)}${avoid.length ? `\n\nNe répète pas ces titres déjà proposés : ${avoid.join(' ; ')}` : ''}`,
  })
  return { titles: titles.map((t) => t.trim()).filter(Boolean).slice(0, 3) }
})
