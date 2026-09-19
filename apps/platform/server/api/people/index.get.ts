import { requireModule } from '../../utils/auth'
import { dbAll, dbOne } from '../../utils/db'

/**
 * Lists members for the current organization, optionally filtered by name or
 * email search, member status, and paginated via `limit`/`offset`.
 * Members are only visible to active orgs subscribed to the PEOPLE module
 * (demo sandboxes always include it).
 */
export default defineEventHandler(async (event) => {
  const org = requireModule(event, 'people')
  const query = getQuery(event)
  const search = typeof query.search === 'string' ? query.search.trim() : ''
  const status = typeof query.status === 'string' ? query.status.trim() : ''
  const limit = Math.min(Math.max(Number(query.limit) || 100, 1), 500)
  const offset = Math.max(Number(query.offset) || 0, 0)

  const args: unknown[] = [org.id]
  let where = 'organization_id = ?'

  if (status) {
    where += ' AND member_status = ?'
    args.push(status)
  }

  if (search) {
    where += ' AND (full_name LIKE ? OR email LIKE ?)'
    const pattern = `%${search}%`
    args.push(pattern, pattern)
  }

  const total = await dbOne(`SELECT COUNT(*) AS count FROM members WHERE ${where}`, args)

  const rows = await dbAll(
    `SELECT * FROM members WHERE ${where} ORDER BY full_name COLLATE NOCASE ASC LIMIT ? OFFSET ?`,
    [...args, limit, offset]
  )

  return { data: rows, total: Number(total?.count ?? 0), limit, offset }
})
