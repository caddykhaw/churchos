import { requireModule } from '../../../utils/auth'
import { useSupabaseAdmin } from '../../../utils/supabase'

/** Enrolls a member into a discipleship track (admin action). */
export default defineEventHandler(async (event) => {
  const org = requireModule(event, 'journey', { role: 'admin' })
  const body = await readBody<Record<string, unknown>>(event)

  const trackId = typeof body?.track_id === 'string' ? body.track_id.trim() : ''
  const menteeId = typeof body?.mentee_id === 'string' ? body.mentee_id.trim() : ''
  const mentorId = typeof body?.mentor_id === 'string' ? body.mentor_id.trim() || null : null

  if (!trackId || !menteeId) {
    throw createError({
      statusCode: 400,
      message: 'track_id and mentee_id are required'
    })
  }

  const supabase = useSupabaseAdmin()

  // Both rows must belong to this org — scoped lookups double as isolation checks.
  const { data: track } = await supabase
    .from('tracks')
    .select('id, prerequisite_track_id, status')
    .eq('id', trackId)
    .eq('organization_id', org.id)
    .single()

  if (!track) {
    throw createError({ statusCode: 404, message: 'Track not found' })
  }

  const { data: mentee } = await supabase
    .from('members')
    .select('id')
    .eq('id', menteeId)
    .eq('organization_id', org.id)
    .single()

  if (!mentee) {
    throw createError({ statusCode: 404, message: 'Member not found' })
  }

  if (mentorId) {
    const { data: mentor } = await supabase
      .from('members')
      .select('id')
      .eq('id', mentorId)
      .eq('organization_id', org.id)
      .single()

    if (!mentor) {
      throw createError({ statusCode: 404, message: 'Mentor not found' })
    }
  }

  // Prerequisite gate: block enrollment when a prerequisite track exists and
  // the mentee has no completed enrollment for it in this org.
  const prerequisiteTrackId = track.prerequisite_track_id as string | null
  if (prerequisiteTrackId) {
    const { data: completed } = await supabase
      .from('enrollments')
      .select('id')
      .eq('organization_id', org.id)
      .eq('track_id', prerequisiteTrackId)
      .eq('mentee_id', menteeId)
      .eq('status', 'completed')
      .limit(1)

    if (!completed || completed.length === 0) {
      throw createError({
        statusCode: 409,
        message: 'Mentee must complete the prerequisite track first'
      })
    }
  }

  // Prevent duplicate active enrollments in the same track.
  const { data: existing } = await supabase
    .from('enrollments')
    .select('id')
    .eq('organization_id', org.id)
    .eq('track_id', trackId)
    .eq('mentee_id', menteeId)
    .eq('status', 'active')
    .limit(1)

  if (existing && existing.length > 0) {
    throw createError({
      statusCode: 409,
      message: 'Member is already enrolled in this track'
    })
  }

  const { data, error } = await supabase
    .from('enrollments')
    .insert({
      organization_id: org.id,
      track_id: trackId,
      mentee_id: menteeId,
      mentor_id: mentorId,
      status: 'active'
    })
    .select()
    .single()

  if (error) {
    throw createError({
      statusCode: 500,
      message: 'Failed to enroll member'
    })
  }

  return data
})
