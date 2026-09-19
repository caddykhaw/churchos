import { requireModule } from '../../../utils/auth'
import { dbOne, dbRun } from '../../../utils/db'

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
      const mentor = await dbOne(
        'SELECT id FROM members WHERE id = ? AND organization_id = ?',
        [mentorId, org.id]
      )

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

  const setClause = Object.keys(patch).map((key) => `${key} = ?`).join(', ')
  const rowsAffected = await dbRun(
    `UPDATE enrollments SET ${setClause} WHERE id = ? AND organization_id = ?`,
    [...Object.values(patch), id, org.id]
  )

  if (rowsAffected === 0) {
    throw createError({ statusCode: 404, message: 'Enrollment not found' })
  }

  return await dbOne('SELECT * FROM enrollments WHERE id = ?', [id])
})
