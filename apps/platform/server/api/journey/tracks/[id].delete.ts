import { requireModule } from '../../../utils/auth'
import { dbOne, dbRun } from '../../../utils/db'

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

  const track = await dbOne(
    'SELECT id FROM tracks WHERE id = ? AND organization_id = ?',
    [id, org.id]
  )

  if (!track) {
    throw createError({ statusCode: 404, message: 'Track not found' })
  }

  const enrollment = await dbOne('SELECT id FROM enrollments WHERE track_id = ? LIMIT 1', [id])

  if (enrollment) {
    throw createError({
      statusCode: 409,
      message: 'Track has enrollments and cannot be deleted. Consider archiving it as a draft instead.'
    })
  }

  // Detach other tracks that reference this one as their prerequisite.
  await dbRun(
    `UPDATE tracks SET prerequisite_track_id = NULL
      WHERE organization_id = ? AND prerequisite_track_id = ?`,
    [org.id, id]
  )

  await dbRun('DELETE FROM tracks WHERE id = ? AND organization_id = ?', [id, org.id])

  return { ok: true }
})
