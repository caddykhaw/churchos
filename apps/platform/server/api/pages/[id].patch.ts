import { requireModule } from '../../utils/auth'
import { useSupabaseAdmin } from '../../utils/supabase'

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
    patch.published = Boolean(body.published)
  }

  if (Object.keys(patch).length === 0) {
    throw createError({ statusCode: 400, message: 'Nothing to update' })
  }

  const { data, error } = await useSupabaseAdmin()
    .from('pages')
    .update(patch)
    .eq('id', id)
    .eq('organization_id', org.id)
    .select()
    .single()

  if (error) {
    // Unique violation on (organization_id, slug) or missing row.
    throw createError({
      statusCode: 409,
      message: 'Page not found, or a page with that slug already exists'
    })
  }

  return data
})
