/** Trois idées de titre pour une course, dans le style demandé. */
const STYLES: Record<string, string> = {
  sobre: 'sobres et factuels (type de séance, distance ou allure)',
  drole: 'drôles, avec de l’autodérision, sans vulgarité',
  epique: 'épiques et inspirants, comme un titre de film',
}

export default defineEventHandler(async (event) => {
  const body = await readBody<{ run?: RunInput; style?: string; avoid?: string[]; planTitle?: string }>(event)
  if (!body?.run) throw createError({ statusCode: 400, statusMessage: 'Course manquante' })
  const style = STYLES[body.style ?? ''] ?? STYLES.sobre
  const avoid = (body.avoid ?? []).slice(0, 30).map((t) => String(t).slice(0, 100))
  const details = await stravaDetails(event, body.run.stravaId)
  const planTitle = typeof body.planTitle === 'string' ? body.planTitle.replace(/\s+/g, ' ').trim().slice(0, 100) : ''

  const { titles } = await aiJson<{ titles: string[] }>(event, {
    name: 'titres',
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['titles'],
      properties: { titles: { type: 'array', items: { type: 'string' } } },
    },
    instructions: `Tu proposes des titres d'activité Strava en français pour un coureur. Donne exactement 3 titres ${style}. Chaque titre fait au plus 60 caractères, sans guillemets, sans hashtag, au plus un emoji. Appuie-toi sur les vraies données de la course et ne les invente pas. Donne le titre seul : jamais d’étiquette entre crochets (comme [KIPRUN]), l’appli les ajoute elle-même.`,
    input: `${describeRun(body.run, details)}${planTitle ? `\nSéance prévue : ${planTitle}` : ''}${avoid.length ? `\n\nNe répète pas ces titres déjà proposés : ${avoid.join(' ; ')}` : ''}`,
  })
  // Titre seul : une étiquette ajoutée malgré la consigne est retirée (l'appli pose les siennes)
  return { titles: (Array.isArray(titles) ? titles : []).map((t) => parseTitle(String(t)).title).filter(Boolean).slice(0, 3) }
})
