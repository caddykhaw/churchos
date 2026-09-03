import { requireModule } from '../../utils/auth'
import { useSupabaseAdmin } from '../../utils/supabase'

/**
 * Updates a website page belonging to the current organization.
 * Currently supports toggling the published flag.
 */
export default defineEventHandler(async (event) => {
  const org = requireModule(event, 'pages')
  const id = getRouterParam(event, 'id')
  const body = await readBody<Record<string, unknown>>(event)

  if (!id) {
    throw createError({ statusCode: 400, message: 'Page id required' })
  }

  const patch: Record<string, unknown> = {}
  if (body?.published !== undefined) {
    patch.published = Boolean(body.published)
  }

  if (Object.keys(patch).length === 0) {
    throw createError({ statusCode: 400, message: 'Nothing to update' })
  }

  const { data, error } = await useSupabaseAdmin()
    .from('pages')
    .update(patch)
    .eq('id', id)
    .eq('organization_id', org.id)
    .select()
    .single()

  if (error) {
    throw createError({
      statusCode: 500,
      message: 'Failed to update page'
    })
  }

  if (!data) {
    throw createError({
      statusCode: 404,
      message: 'Page not found'
    })
  }

  return data
})