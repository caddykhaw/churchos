import { requireModule } from '../../utils/auth'
import { dbAll } from '../../utils/db'

/** Lists website pages for the current organization, newest first. */
export default defineEventHandler(async (event) => {
  const org = requireModule(event, 'pages')

  const rows = await dbAll(
    'SELECT * FROM pages WHERE organization_id = ? ORDER BY created_at DESC',
    [org.id]
  )

  return rows.map((row) => ({ ...row, published: Number(row.published) === 1 }))
})
