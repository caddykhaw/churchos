import { requireModule } from '../../utils/auth'
import { dbOne, dbRun } from '../../utils/db'

const PAGE_TITLE_FIELDS = ['title_en', 'title_zh', 'title_ms', 'title_ta'] as const

/**
 * Updates a website page of the current organization: slug (with format
 * validation), multilingual titles, and published state.
 */
export default defineEventHandler(async (event) => {
  const org = requireModule(event, 'pages', { role: 'admin' })
  const id = getRouterParam(event, 'id')
  const body = await readBody<Record<string, unknown>>(event)

  if (!id) {
    throw createError({ statusCode: 400, message: 'Page id required' })
  }

  const patch: Record<string, unknown> = {}

  if (body?.slug !== undefined) {
    const slug = typeof body.slug === 'string' ? body.slug.trim().toLowerCase() : ''
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      throw createError({
        statusCode: 400,
        message: 'Slug must be lowercase letters, numbers, and hyphens (e.g. about-us)'
      })
    }
    patch.slug = slug
  }

  for (const field of PAGE_TITLE_FIELDS) {
    if (body?.[field] !== undefined) {
      patch[field] = typeof body[field] === 'string' && body[field].trim() !== '' ? body[field].trim() : null
    }
  }

  if (body?.published !== undefined) {
    patch.published = body.published ? 1 : 0
  }

  if (Object.keys(patch).length === 0) {
    throw createError({ statusCode: 400, message: 'Nothing to update' })
  }

  const setClause = Object.keys(patch).map((key) => `${key} = ?`).join(', ')

  let rowsAffected: number
  try {
    rowsAffected = await dbRun(
      `UPDATE pages SET ${setClause}, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        WHERE id = ? AND organization_id = ?`,
      [...Object.values(patch), id, org.id]
    )
  } catch (error) {
    // Unique violation on (organization_id, slug) or missing row.
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
      throw createError({ statusCode: 409, message: 'A page with that slug already exists' })
    }
    throw error
  }

  if (rowsAffected === 0) {
    throw createError({ statusCode: 404, message: 'Page not found' })
  }

  const page = await dbOne('SELECT * FROM pages WHERE id = ?', [id])
  return page ? { ...page, published: Number(page.published) === 1 } : null
})
