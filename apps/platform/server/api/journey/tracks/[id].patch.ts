import { requireModule } from '../../../utils/auth'
import { dbOne, dbRun } from '../../../utils/db'

/**
 * Updates a discipleship track of the current organization: bilingual titles,
 * description, publish state, and prerequisite assignment (with cycle guard).
 */
export default defineEventHandler(async (event) => {
  const org = requireModule(event, 'journey', { role: 'admin' })
  const id = getRouterParam(event, 'id')
  const body = await readBody<Record<string, unknown>>(event)

  if (!id) {
    throw createError({ statusCode: 400, message: 'Track id required' })
  }

  const patch: Record<string, unknown> = {}

  if (body?.title_en !== undefined) {
    const titleEn = typeof body.title_en === 'string' ? body.title_en.trim() : ''
    if (titleEn.length < 2) {
      throw createError({ statusCode: 400, message: 'Track title must be at least 2 characters' })
    }
    patch.title_en = titleEn
  }

  if (body?.title_zh !== undefined) {
    patch.title_zh = typeof body.title_zh === 'string' && body.title_zh.trim() !== '' ? body.title_zh.trim() : null
  }

  if (body?.description !== undefined) {
    patch.description = typeof body.description === 'string' && body.description.trim() !== '' ? body.description.trim() : null
  }

  if (body?.status !== undefined) {
    patch.status = body.status === 'published' ? 'published' : 'draft'
  }

  if (body?.prerequisite_track_id !== undefined) {
    const prereqId = typeof body.prerequisite_track_id === 'string' ? body.prerequisite_track_id.trim() : ''
    if (prereqId === id) {
      throw createError({ statusCode: 400, message: 'A track cannot be its own prerequisite' })
    }
    if (prereqId) {
      const prereq = await dbOne(
        'SELECT id, prerequisite_track_id FROM tracks WHERE id = ? AND organization_id = ?',
        [prereqId, org.id]
      )

      if (!prereq) {
        throw createError({ statusCode: 404, message: 'Prerequisite track not found' })
      }
      // Cycle guard: reject chains that would loop back to this track.
      if (prereq.prerequisite_track_id === id) {
        throw createError({ statusCode: 400, message: 'Prerequisite chain would create a cycle' })
      }
      patch.prerequisite_track_id = prereqId
    } else {
      patch.prerequisite_track_id = null
    }
  }

  if (Object.keys(patch).length === 0) {
    throw createError({ statusCode: 400, message: 'Nothing to update' })
  }

  const setClause = Object.keys(patch).map((key) => `${key} = ?`).join(', ')
  const rowsAffected = await dbRun(
    `UPDATE tracks SET ${setClause}, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE id = ? AND organization_id = ?`,
    [...Object.values(patch), id, org.id]
  )

  if (rowsAffected === 0) {
    throw createError({ statusCode: 404, message: 'Track not found' })
  }

  return await dbOne('SELECT * FROM tracks WHERE id = ?', [id])
})
