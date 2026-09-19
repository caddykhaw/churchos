import { requireModule } from '../../utils/auth'
import { dbOne } from '../../utils/db'

/** Returns a single website page of the current organization. */
export default defineEventHandler(async (event) => {
  const org = requireModule(event, 'pages')
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, message: 'Page id required' })
  }

  const page = await dbOne(
    'SELECT * FROM pages WHERE id = ? AND organization_id = ?',
    [id, org.id]
  )

  if (!page) {
    throw createError({ statusCode: 404, message: 'Page not found' })
  }

  return { ...page, published: Number(page.published) === 1 }
})
