import { requireModule } from '../../../utils/auth'
import { useSupabaseAdmin } from '../../../utils/supabase'

/**
 * Deletes a discipleship track of the current organization. Blocked while
 * enrollments reference the track (hard dependency); clears inbound
 * prerequisite references so other tracks keep working.
 */
export default defineEventHandler(async (event) => {
  const org = requireModule(event, 'journey', { role: 'admin' })
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, message: 'Track id required' })
  }

  const supabase = useSupabaseAdmin()

  const { data: track } = await supabase
    .from('tracks')
    .select('id')
    .eq('id', id)
    .eq('organization_id', org.id)
    .single()

  if (!track) {
    throw createError({ statusCode: 404, message: 'Track not found' })
  }

  const { data: enrollments } = await supabase
    .from('enrollments')
    .select('id')
    .eq('track_id', id)
    .limit(1)

  if (enrollments && enrollments.length > 0) {
    throw createError({
      statusCode: 409,
      message: 'Track has enrollments and cannot be deleted. Consider archiving it as a draft instead.'
    })
  }

  // Detach other tracks that reference this one as their prerequisite.
  await supabase
    .from('tracks')
    .update({ prerequisite_track_id: null })
    .eq('organization_id', org.id)
    .eq('prerequisite_track_id', id)

  const { error } = await supabase
    .from('tracks')
    .delete()
    .eq('id', id)
    .eq('organization_id', org.id)

  if (error) {
    throw createError({
      statusCode: 500,
      message: 'Failed to delete track'
    })
  }

  return { ok: true }
})
