import { requireModule } from '../../utils/auth'
import { dbOne, dbRun } from '../../utils/db'

/** Adds a member to the current organization. */
export default defineEventHandler(async (event) => {
  const org = requireModule(event, 'people', { role: 'admin' })
  const body = await readBody<Record<string, unknown>>(event)

  const fullName = typeof body?.full_name === 'string' ? body.full_name.trim() : ''
  if (fullName.length < 2) {
    throw createError({
      statusCode: 400,
      message: 'Full name is required'
    })
  }

  const memberStatus = typeof body?.member_status === 'string' && body.member_status
    ? body.member_status
    : 'active'

  if (!['active', 'inactive', 'former', 'pending'].includes(memberStatus)) {
    throw createError({ statusCode: 400, message: 'Invalid member_status' })
  }

  const id = crypto.randomUUID()
  try {
    await dbRun(
      `INSERT INTO members (id, organization_id, full_name, member_number, email, phone, gender,
                            marital_status, date_of_birth, member_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        org.id,
        fullName,
        typeof body?.member_number === 'string' ? body.member_number.trim() || null : null,
        typeof body?.email === 'string' ? body.email.trim() || null : null,
        typeof body?.phone === 'string' ? body.phone.trim() || null : null,
        typeof body?.gender === 'string' ? body.gender.trim() || null : null,
        typeof body?.marital_status === 'string' ? body.marital_status.trim() || null : null,
        typeof body?.date_of_birth === 'string' && body.date_of_birth ? body.date_of_birth : null,
        memberStatus
      ]
    )
  } catch (error) {
    if (error instanceof Error && error.message.includes('CHECK constraint failed')) {
      throw createError({ statusCode: 400, message: 'Invalid member_status' })
    }
    throw createError({ statusCode: 500, message: 'Failed to add member' })
  }

  return await dbOne('SELECT * FROM members WHERE id = ?', [id])
})
