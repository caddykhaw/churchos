import { requireModule } from '../../utils/auth'
import { useSupabaseAdmin } from '../../utils/supabase'

/** Returns a single member of the current organization. */
export default defineEventHandler(async (event) => {
  const org = requireModule(event, 'people')
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, message: 'Member id required' })
  }

  const { data, error } = await useSupabaseAdmin()
    .from('members')
    .select('*')
    .eq('id', id)
    .eq('organization_id', org.id)
    .single()

  if (error) {
    throw createError({
      statusCode: 404,
      message: 'Member not found'
    })
  }

  return data
})
