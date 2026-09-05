import { requireModule } from '../../utils/auth'
import { useSupabaseAdmin } from '../../utils/supabase'

/**
 * Lists members for the current organization, optionally filtered by name or
 * email search, member status, and paginated via `limit`/`offset`.
 * Members are only visible to active orgs subscribed to the PEOPLE module
 * (demo sandboxes always include it).
 */
export default defineEventHandler(async (event) => {
  const org = requireModule(event, 'people')
  const query = getQuery(event)
  const search = typeof query.search === 'string' ? query.search.trim() : ''
  const status = typeof query.status === 'string' ? query.status.trim() : ''
  const limit = Math.min(Math.max(Number(query.limit) || 100, 1), 500)
  const offset = Math.max(Number(query.offset) || 0, 0)

  let builder = useSupabaseAdmin()
    .from('members')
    .select('*', { count: 'exact' })
    .eq('organization_id', org.id)
    .order('full_name', { ascending: true })
    .range(offset, offset + limit - 1)

  if (status) {
    builder = builder.eq('member_status', status)
  }

  if (search) {
    builder = builder.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`)
  }

  const { data, error, count } = await builder

  if (error) {
    throw createError({
      statusCode: 500,
      message: 'Failed to load members'
    })
  }

  return { data: data ?? [], total: count ?? data?.length ?? 0, limit, offset }
})