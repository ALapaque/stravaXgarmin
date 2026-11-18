/** Estimation de VMA, VO2max, allure seuil et temps au semi à partir de plusieurs courses. */
export default defineEventHandler(async (event) => {
  const body = await readBody<{ runs?: RunInput[] }>(event)
  const runs = (body?.runs ?? []).slice(0, 20)
  if (!runs.length) throw createError({ statusCode: 400, statusMessage: 'Choisis au moins une course' })

  const level = await aiJson<{ vma: number; vo2max: number; threshold: string; half: string }>(event, {
    name: 'niveau',
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['vma', 'vo2max', 'threshold', 'half'],
      properties: {
        vma: { type: 'number', description: 'VMA en km/h, une décimale' },
        vo2max: { type: 'integer', description: 'VO2max estimée en ml/kg/min' },
        threshold: { type: 'string', description: 'Allure seuil au format m:ss (par km)' },
        half: { type: 'string', description: 'Temps estimé au semi-marathon au format h:mm' },
      },
    },
    instructions:
      'Tu es un entraîneur de course à pied. À partir des courses récentes, estime la VMA, la VO2max, l’allure au seuil et le temps sur semi-marathon. Base-toi sur les séances les plus intenses (fractionné, tempo) et la fréquence cardiaque si elle est donnée. Reste prudent et réaliste.',
    input: runs.map((r, i) => `Course ${i + 1}\n${describeRun(r)}`).join('\n\n'),
  })
  return { ...level, vma: Math.round(level.vma * 10) / 10, count: runs.length }
})
