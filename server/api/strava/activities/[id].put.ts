/*
 * Modifie le nom et/ou la description d'une activité Strava.
 * Strava remplace toute la description à chaque écriture : le serveur relit donc la description
 * actuelle et n'y change que le texte de l'appli (mergeDescription), jamais les notes du coureur.
 */
interface Body {
  name?: string
  descriptionBlock?: { text?: string; previous?: string }
  /** Ancien remplacement complet : refusé (une vieille version de l'appli ouverte ne doit plus écraser) */
  description?: unknown
}

type StravaDetail = { id: number; name: string; description: string | null }

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  const body = await readBody<Body>(event)
  if (!Number.isInteger(id) || id <= 0) throw createError({ statusCode: 400, statusMessage: 'Identifiant invalide' })
  if (body && 'description' in body && body.description !== undefined) {
    throw createError({ statusCode: 409, statusMessage: 'Mets l’appli à jour pour modifier une description : ferme-la puis rouvre-la.' })
  }

  const update: Record<string, string> = {}
  if (typeof body?.name === 'string') {
    const name = body.name.trim()
    if (!name || name.length > 255) throw createError({ statusCode: 400, statusMessage: 'Nom vide ou trop long' })
    update.name = name
  }

  const block = body?.descriptionBlock
  let merge: { previousDescription: string; change: MergeChange } | undefined
  let current: StravaDetail | undefined
  if (block !== undefined) {
    const text = block?.text
    const previous = block?.previous ?? ''
    if (typeof text !== 'string' || typeof previous !== 'string') throw createError({ statusCode: 400, statusMessage: 'Texte invalide' })
    if (text.length > 3000 || previous.length > 5000) throw createError({ statusCode: 400, statusMessage: 'Texte trop long' })
    // Relecture juste avant d'écrire : si elle échoue, rien n'est écrit
    current = await stravaFetch<StravaDetail>(event, `/activities/${id}`)
    const previousDescription = normalizeNewlines(current.description)
    const r = mergeDescription(previousDescription, text, previous)
    merge = { previousDescription, change: r.change }
    // Texte envoyé avec des « \n » (mergeDescription a déjà normalisé)
    if (r.change === 'added' || r.change === 'replaced' || r.change === 'removed') update.description = r.text
  }

  if (!Object.keys(update).length && !merge) throw createError({ statusCode: 400, statusMessage: 'Rien à modifier' })

  let a = current
  if (Object.keys(update).length) {
    try {
      a = await stravaFetch<StravaDetail>(event, `/activities/${id}`, { method: 'PUT', body: update })
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode
      // Session expirée ou trop de demandes : le message d'origine dit mieux quoi faire
      if (update.description !== undefined && status !== 401 && status !== 429) {
        throw createError({ statusCode: 502, statusMessage: 'Strava a refusé ce texte. Il est peut-être trop long.' })
      }
      throw e
    }
  }

  return {
    id: a!.id,
    name: a!.name,
    description: normalizeNewlines(a!.description),
    ...(merge ?? {}),
  }
})
