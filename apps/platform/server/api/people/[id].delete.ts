import { requireModule } from '../../utils/auth'
import { useSupabaseAdmin } from '../../utils/supabase'

/**
 * Archives a member of the current organization (soft delete: member_status
 * transitions to 'former'). Returns 409 when the member is already archived.
 */
export default defineEventHandler(async (event) => {
  const org = requireModule(event, 'people', { role: 'admin' })
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, message: 'Member id required' })
  }

  const { data, error } = await useSupabaseAdmin()
    .from('members')
    .update({ member_status: 'former' })
    .eq('id', id)
    .eq('organization_id', org.id)
    .neq('member_status', 'former')
    .select()
    .single()

  if (error) {
    throw createError({
      statusCode: 404,
      message: 'Member not found'
    })
  }

  return data
})
