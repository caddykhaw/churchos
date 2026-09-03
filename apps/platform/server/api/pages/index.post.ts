import { requireModule } from '../../utils/auth'
import { useSupabaseAdmin } from '../../utils/supabase'

const SLUG_PATTERN = /^(?=.{1,60}$)[a-z0-9]+(?:-[a-z0-9]+)*$/

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && error.code === '23505'
}

/** Creates a website page for the current organization. */
export default defineEventHandler(async (event) => {
  const org = requireModule(event, 'pages')
  const body = await readBody<Record<string, unknown>>(event)

  const slug = typeof body?.slug === 'string' ? body.slug.trim().toLowerCase() : ''
  const titleEn = typeof body?.title_en === 'string' ? body.title_en.trim() : ''

  if (!SLUG_PATTERN.test(slug)) {
    throw createError({
      statusCode: 400,
      message: 'Slug must be lowercase letters, numbers, and hyphens only'
    })
  }

  if (titleEn.length < 2) {
    throw createError({
      statusCode: 400,
      message: 'Page title is required'
    })
  }

  const { data, error } = await useSupabaseAdmin()
    .from('pages')
    .insert({
      organization_id: org.id,
      slug,
      title_en: titleEn,
      title_zh: typeof body?.title_zh === 'string' ? body.title_zh.trim() || null : null,
      title_ms: typeof body?.title_ms === 'string' ? body.title_ms.trim() || null : null,
      title_ta: typeof body?.title_ta === 'string' ? body.title_ta.trim() || null : null,
      published: false
    })
    .select()
    .single()

  if (isUniqueViolation(error)) {
    throw createError({
      statusCode: 409,
      message: 'A page with this slug already exists'
    })
  }

  if (error) {
    throw createError({
      statusCode: 500,
      message: 'Failed to create page'
    })
  }

  return data
})