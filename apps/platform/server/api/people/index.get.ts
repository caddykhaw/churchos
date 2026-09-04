import { requireModule } from '../../utils/auth'
import { useSupabaseAdmin } from '../../utils/supabase'

/**
 * Lists members for the current organization, optionally filtered by name
 * or email search. Members are only visible to active orgs subscribed to the
 * PEOPLE module (demo sandboxes always include it).
 */
export default defineEventHandler(async (event) => {
  const org = requireModule(event, 'people')
  const query = getQuery(event)
  const search = typeof query.search === 'string' ? query.search.trim() : ''

  let builder = useSupabaseAdmin()
    .from('members')
    .select('*')
    .eq('organization_id', org.id)
    .order('full_name', { ascending: true })

  if (search) {
    builder = builder.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`)
  }

  const { data, error } = await builder

  if (error) {
    throw createError({
      statusCode: 500,
      message: 'Failed to load members'
    })
  }

  return data ?? []
})