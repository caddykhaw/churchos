import { requireModule } from '../../utils/auth'
import { useSupabaseAdmin } from '../../utils/supabase'

/** Returns a single website page of the current organization. */
export default defineEventHandler(async (event) => {
  const org = requireModule(event, 'pages')
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, message: 'Page id required' })
  }

  const { data, error } = await useSupabaseAdmin()
    .from('pages')
    .select('*')
    .eq('id', id)
    .eq('organization_id', org.id)
    .single()

  if (error) {
    throw createError({
      statusCode: 404,
      message: 'Page not found'
    })
  }

  return data
})
