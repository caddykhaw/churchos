import { requireModule } from '../../utils/auth'
import { dbOne } from '../../utils/db'

/** Returns a single member of the current organization. */
export default defineEventHandler(async (event) => {
  const org = requireModule(event, 'people')
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, message: 'Member id required' })
  }

  const member = await dbOne(
    'SELECT * FROM members WHERE id = ? AND organization_id = ?',
    [id, org.id]
  )

  if (!member) {
    throw createError({ statusCode: 404, message: 'Member not found' })
  }

  return member
})
