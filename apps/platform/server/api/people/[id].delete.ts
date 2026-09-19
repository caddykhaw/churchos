import { requireModule } from '../../utils/auth'
import { dbOne, dbRun } from '../../utils/db'

/**
 * Archives a member of the current organization (soft delete: member_status
 * transitions to 'former'). Returns 404 when the member is already archived
 * or missing.
 */
export default defineEventHandler(async (event) => {
  const org = requireModule(event, 'people', { role: 'admin' })
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, message: 'Member id required' })
  }

  const rowsAffected = await dbRun(
    `UPDATE members
        SET member_status = 'former', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE id = ? AND organization_id = ? AND member_status != 'former'`,
    [id, org.id]
  )

  if (rowsAffected === 0) {
    throw createError({ statusCode: 404, message: 'Member not found' })
  }

  return await dbOne('SELECT * FROM members WHERE id = ?', [id])
})
