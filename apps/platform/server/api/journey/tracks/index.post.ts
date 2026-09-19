import { requireModule } from '../../../utils/auth'
import { dbOne, dbRun } from '../../../utils/db'

/** Creates a discipleship track for the current organization. */
export default defineEventHandler(async (event) => {
  const org = requireModule(event, 'journey', { role: 'admin' })
  const body = await readBody<Record<string, unknown>>(event)

  const titleEn = typeof body?.title_en === 'string' ? body.title_en.trim() : ''
  if (titleEn.length < 2) {
    throw createError({
      statusCode: 400,
      message: 'Track title is required'
    })
  }

  const id = crypto.randomUUID()
  await dbRun(
    `INSERT INTO tracks (id, organization_id, title_en, title_zh, description, status)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      id,
      org.id,
      titleEn,
      typeof body?.title_zh === 'string' ? body.title_zh.trim() || null : null,
      typeof body?.description === 'string' ? body.description.trim() || null : null,
      body?.status === 'published' ? 'published' : 'draft'
    ]
  )

  return await dbOne('SELECT * FROM tracks WHERE id = ?', [id])
})
