import { requireModule } from '../../utils/auth'
import { useSupabaseAdmin } from '../../utils/supabase'

/**
 * Deletes a website page of the current organization. Published pages must be
 * unpublished first to avoid breaking the public site mid-visit.
 */
export default defineEventHandler(async (event) => {
  const org = requireModule(event, 'pages', { role: 'admin' })
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, message: 'Page id required' })
  }

  const supabase = useSupabaseAdmin()

  const { data: page } = await supabase
    .from('pages')
    .select('id, published')
    .eq('id', id)
    .eq('organization_id', org.id)
    .single()

  if (!page) {
    throw createError({ statusCode: 404, message: 'Page not found' })
  }

  if (page.published) {
    throw createError({
      statusCode: 409,
      message: 'Page is published. Unpublish it before deleting.'
    })
  }

  const { error } = await supabase
    .from('pages')
    .delete()
    .eq('id', id)
    .eq('organization_id', org.id)

  if (error) {
    throw createError({
      statusCode: 500,
      message: 'Failed to delete page'
    })
  }

  return { ok: true }
})
