import { requireModule } from '../../utils/auth'
import { dbOne, dbRun } from '../../utils/db'

/**
 * Deletes a website page of the current organization. Published pages must be
 * unpublished first to avoid breaking the public site mid-visit.
 */
export default defineEventHandler(async (event) => {
  const org = requireModule(event, 'pages', { role: 'admin' })
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, message: 'Page id required' })
  }

  const page = await dbOne(
    'SELECT id, published FROM pages WHERE id = ? AND organization_id = ?',
    [id, org.id]
  )

  if (!page) {
    throw createError({ statusCode: 404, message: 'Page not found' })
  }

  if (Number(page.published) === 1) {
    throw createError({
      statusCode: 409,
      message: 'Page is published. Unpublish it before deleting.'
    })
  }

  await dbRun('DELETE FROM pages WHERE id = ? AND organization_id = ?', [id, org.id])

  return { ok: true }
})
