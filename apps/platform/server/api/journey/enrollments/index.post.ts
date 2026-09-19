import { requireModule } from '../../../utils/auth'
import { dbOne, dbRun } from '../../../utils/db'

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

  // Both rows must belong to this org — scoped lookups double as isolation checks.
  const track = await dbOne(
    'SELECT id, prerequisite_track_id, status FROM tracks WHERE id = ? AND organization_id = ?',
    [trackId, org.id]
  )

  if (!track) {
    throw createError({ statusCode: 404, message: 'Track not found' })
  }

  const mentee = await dbOne(
    'SELECT id FROM members WHERE id = ? AND organization_id = ?',
    [menteeId, org.id]
  )

  if (!mentee) {
    throw createError({ statusCode: 404, message: 'Member not found' })
  }

  if (mentorId) {
    const mentor = await dbOne(
      'SELECT id FROM members WHERE id = ? AND organization_id = ?',
      [mentorId, org.id]
    )

    if (!mentor) {
      throw createError({ statusCode: 404, message: 'Mentor not found' })
    }
  }

  // Prerequisite gate: block enrollment when a prerequisite track exists and
  // the mentee has no completed enrollment for it in this org.
  const prerequisiteTrackId = track.prerequisite_track_id as string | null
  if (prerequisiteTrackId) {
    const completed = await dbOne(
      `SELECT id FROM enrollments
        WHERE organization_id = ? AND track_id = ? AND mentee_id = ? AND status = 'completed'
        LIMIT 1`,
      [org.id, prerequisiteTrackId, menteeId]
    )

    if (!completed) {
      throw createError({
        statusCode: 409,
        message: 'Mentee must complete the prerequisite track first'
      })
    }
  }

  // Prevent duplicate active enrollments in the same track.
  const existing = await dbOne(
    `SELECT id FROM enrollments
      WHERE organization_id = ? AND track_id = ? AND mentee_id = ? AND status = 'active'
      LIMIT 1`,
    [org.id, trackId, menteeId]
  )

  if (existing) {
    throw createError({
      statusCode: 409,
      message: 'Member is already enrolled in this track'
    })
  }

  const id = crypto.randomUUID()
  await dbRun(
    `INSERT INTO enrollments (id, organization_id, track_id, mentee_id, mentor_id, status)
     VALUES (?, ?, ?, ?, ?, 'active')`,
    [id, org.id, trackId, menteeId, mentorId]
  )

  return await dbOne('SELECT * FROM enrollments WHERE id = ?', [id])
})
