import { requireModule } from '../../../utils/auth'
import { useSupabaseAdmin } from '../../../utils/supabase'

/**
 * Lists enrollments for the current organization with track and member
 * names resolved, newest first.
 */
export default defineEventHandler(async (event) => {
  const org = requireModule(event, 'journey')

  const { data, error } = await useSupabaseAdmin()
    .from('enrollments')
    .select(`
      id,
      status,
      enrolled_at,
      completed_at,
      tracks(title_en),
      mentee:members!mentee_id(full_name),
      mentor:members!mentor_id(full_name)
    `)
    .eq('organization_id', org.id)
    .order('enrolled_at', { ascending: false })

  if (error) {
    throw createError({
      statusCode: 500,
      message: 'Failed to load enrollments'
    })
  }

  return data ?? []
})