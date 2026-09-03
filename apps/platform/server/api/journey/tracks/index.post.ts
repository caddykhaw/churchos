import { requireModule } from '../../../utils/auth'
import { useSupabaseAdmin } from '../../../utils/supabase'

/** Creates a discipleship track for the current organization. */
export default defineEventHandler(async (event) => {
  const org = requireModule(event, 'journey')
  const body = await readBody<Record<string, unknown>>(event)

  const titleEn = typeof body?.title_en === 'string' ? body.title_en.trim() : ''
  if (titleEn.length < 2) {
    throw createError({
      statusCode: 400,
      message: 'Track title is required'
    })
  }

  const { data, error } = await useSupabaseAdmin()
    .from('tracks')
    .insert({
      organization_id: org.id,
      title_en: titleEn,
      title_zh: typeof body?.title_zh === 'string' ? body.title_zh.trim() || null : null,
      description: typeof body?.description === 'string' ? body.description.trim() || null : null,
      status: body?.status === 'published' ? 'published' : 'draft'
    })
    .select()
    .single()

  if (error) {
    throw createError({
      statusCode: 500,
      message: 'Failed to create track'
    })
  }

  return data
})