import { requireModule } from '../../../utils/auth'
import { useSupabaseAdmin } from '../../../utils/supabase'

const ENROLLMENT_STATUSES = ['active', 'completed', 'dropped'] as const

/**
 * Updates an enrollment of the current organization: status transitions
 * (active/completed/dropped) and mentor reassignment.
 */
export default defineEventHandler(async (event) => {
  const org = requireModule(event, 'journey', { role: 'admin' })
  const id = getRouterParam(event, 'id')
  const body = await readBody<Record<string, unknown>>(event)

  if (!id) {
    throw createError({ statusCode: 400, message: 'Enrollment id required' })
  }

  const patch: Record<string, unknown> = {}

  if (body?.status !== undefined) {
    const status = body.status
    if (typeof status !== 'string' || !ENROLLMENT_STATUSES.includes(status as (typeof ENROLLMENT_STATUSES)[number])) {
      throw createError({
        statusCode: 400,
        message: `status must be one of: ${ENROLLMENT_STATUSES.join(', ')}`
      })
    }
    patch.status = status
    if (status === 'completed') {
      patch.completed_at = new Date().toISOString()
    }
  }

  if (body?.mentor_id !== undefined) {
    const mentorId = typeof body.mentor_id === 'string' ? body.mentor_id.trim() : ''
    if (mentorId) {
      const { data: mentor } = await useSupabaseAdmin()
        .from('members')
        .select('id')
        .eq('id', mentorId)
        .eq('organization_id', org.id)
        .single()

      if (!mentor) {
        throw createError({ statusCode: 404, message: 'Mentor not found' })
      }
      patch.mentor_id = mentorId
    } else {
      patch.mentor_id = null
    }
  }

  if (Object.keys(patch).length === 0) {
    throw createError({ statusCode: 400, message: 'Nothing to update' })
  }

  const { data, error } = await useSupabaseAdmin()
    .from('enrollments')
    .update(patch)
    .eq('id', id)
    .eq('organization_id', org.id)
    .select()
    .single()

  if (error) {
    throw createError({
      statusCode: 404,
      message: 'Enrollment not found'
    })
  }

  return data
})
