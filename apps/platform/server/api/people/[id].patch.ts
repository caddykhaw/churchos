import { requireModule } from '../../utils/auth'
import { useSupabaseAdmin } from '../../utils/supabase'

const MEMBER_STATUSES = ['active', 'inactive', 'former'] as const

/**
 * Updates a member of the current organization. Only fields in the editable
 * set are accepted; `member_status` is constrained to known values.
 */
export default defineEventHandler(async (event) => {
  const org = requireModule(event, 'people', { role: 'admin' })
  const id = getRouterParam(event, 'id')
  const body = await readBody<Record<string, unknown>>(event)

  if (!id) {
    throw createError({ statusCode: 400, message: 'Member id required' })
  }

  const patch: Record<string, unknown> = {}

  if (body?.full_name !== undefined) {
    const fullName = typeof body.full_name === 'string' ? body.full_name.trim() : ''
    if (fullName.length < 2) {
      throw createError({ statusCode: 400, message: 'Full name must be at least 2 characters' })
    }
    patch.full_name = fullName
  }

  for (const field of ['email', 'phone', 'gender', 'marital_status', 'address', 'emergency_contact_name', 'emergency_contact_phone'] as const) {
    if (body?.[field] !== undefined) {
      patch[field] = typeof body[field] === 'string' && (body[field] as string).trim() !== ''
        ? (body[field] as string).trim()
        : null
    }
  }

  if (body?.member_status !== undefined) {
    const status = body.member_status
    if (typeof status !== 'string' || !MEMBER_STATUSES.includes(status as (typeof MEMBER_STATUSES)[number])) {
      throw createError({
        statusCode: 400,
        message: `member_status must be one of: ${MEMBER_STATUSES.join(', ')}`
      })
    }
    patch.member_status = status
  }

  if (Object.keys(patch).length === 0) {
    throw createError({ statusCode: 400, message: 'Nothing to update' })
  }

  const { data, error } = await useSupabaseAdmin()
    .from('members')
    .update(patch)
    .eq('id', id)
    .eq('organization_id', org.id)
    .select()
    .single()

  if (error) {
    throw createError({
      statusCode: 404,
      message: 'Member not found'
    })
  }

  return data
})
