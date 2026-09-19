import { requireModule } from '../../../utils/auth'
import { dbAll } from '../../../utils/db'

/**
 * Lists discipleship tracks for the current organization with their
 * enrollment counts, newest first.
 */
export default defineEventHandler(async (event) => {
  const org = requireModule(event, 'journey')

  const rows = await dbAll(
    `SELECT t.*, (
       SELECT COUNT(*) FROM enrollments e WHERE e.track_id = t.id
     ) AS enrollment_count
       FROM tracks t
      WHERE t.organization_id = ?
      ORDER BY t.created_at DESC`,
    [org.id]
  )

  return rows
})
