import { requireModule } from '../../utils/auth'
import { useSupabaseAdmin } from '../../utils/supabase'

/** Lists website pages for the current organization, newest first. */
export default defineEventHandler(async (event) => {
  const org = requireModule(event, 'pages')

  const { data, error } = await useSupabaseAdmin()
    .from('pages')
    .select('*')
    .eq('organization_id', org.id)
    .order('created_at', { ascending: false })

  if (error) {
    throw createError({
      statusCode: 500,
      message: 'Failed to load pages'
    })
  }

  return data ?? []
})