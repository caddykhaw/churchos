import { requireModule } from '../../utils/auth'
import { useSupabaseAdmin } from '../../utils/supabase'

/** Adds a member to the current organization. */
export default defineEventHandler(async (event) => {
  const org = requireModule(event, 'people')
  const body = await readBody<Record<string, unknown>>(event)

  const fullName = typeof body?.full_name === 'string' ? body.full_name.trim() : ''
  if (fullName.length < 2) {
    throw createError({
      statusCode: 400,
      message: 'Full name is required'
    })
  }

  const { data, error } = await useSupabaseAdmin()
    .from('members')
    .insert({
      organization_id: org.id,
      full_name: fullName,
      member_number: typeof body?.member_number === 'string' ? body.member_number.trim() || null : null,
      email: typeof body?.email === 'string' ? body.email.trim() || null : null,
      phone: typeof body?.phone === 'string' ? body.phone.trim() || null : null,
      gender: typeof body?.gender === 'string' ? body.gender.trim() || null : null,
      marital_status: typeof body?.marital_status === 'string' ? body.marital_status.trim() || null : null,
      date_of_birth: typeof body?.date_of_birth === 'string' && body.date_of_birth ? body.date_of_birth : null,
      member_status: typeof body?.member_status === 'string' && body.member_status ? body.member_status : 'active'
    })
    .select()
    .single()

  if (error) {
    throw createError({
      statusCode: 500,
      message: 'Failed to add member'
    })
  }

  return data
})