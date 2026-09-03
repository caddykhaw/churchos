import { requireModule } from '../../../utils/auth'
import { useSupabaseAdmin } from '../../../utils/supabase'

/**
 * Lists discipleship tracks for the current organization with their
 * enrollment counts, newest first.
 */
export default defineEventHandler(async (event) => {
  const org = requireModule(event, 'journey')

  const { data, error } = await useSupabaseAdmin()
    .from('tracks')
    .select('*, enrollments(count)')
    .eq('organization_id', org.id)
    .order('created_at', { ascending: false })

  if (error) {
    throw createError({
      statusCode: 500,
      message: 'Failed to load tracks'
    })
  }

  return data ?? []
})