import { requireModule } from '../../../utils/auth'
import { dbAll } from '../../../utils/db'

/**
 * Lists enrollments for the current organization with track and member
 * names resolved, newest first.
 */
export default defineEventHandler(async (event) => {
  const org = requireModule(event, 'journey')

  const rows = await dbAll(
    `SELECT e.id, e.status, e.enrolled_at, e.completed_at,
            t.title_en AS track_title,
            mentee.full_name AS mentee_name,
            mentor.full_name AS mentor_name
       FROM enrollments e
       JOIN tracks t ON t.id = e.track_id
       JOIN members mentee ON mentee.id = e.mentee_id
       LEFT JOIN members mentor ON mentor.id = e.mentor_id
      WHERE e.organization_id = ?
      ORDER BY e.enrolled_at DESC`,
    [org.id]
  )

  return rows
})
