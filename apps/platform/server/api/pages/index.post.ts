import { requireModule } from '../../utils/auth'
import { dbOne, dbRun } from '../../utils/db'

const SLUG_PATTERN = /^(?=.{1,60}$)[a-z0-9]+(?:-[a-z0-9]+)*$/

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Error && error.message.includes('UNIQUE constraint failed')
}

/** Creates a website page for the current organization. */
export default defineEventHandler(async (event) => {
  const org = requireModule(event, 'pages', { role: 'admin' })
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

  const id = crypto.randomUUID()
  try {
    await dbRun(
      `INSERT INTO pages (id, organization_id, slug, title_en, title_zh, title_ms, title_ta, published)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        id,
        org.id,
        slug,
        titleEn,
        typeof body?.title_zh === 'string' ? body.title_zh.trim() || null : null,
        typeof body?.title_ms === 'string' ? body.title_ms.trim() || null : null,
        typeof body?.title_ta === 'string' ? body.title_ta.trim() || null : null
      ]
    )
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw createError({
        statusCode: 409,
        message: 'A page with this slug already exists'
      })
    }
    throw createError({ statusCode: 500, message: 'Failed to create page' })
  }

  const page = await dbOne('SELECT * FROM pages WHERE id = ?', [id])
  return page ? { ...page, published: Number(page.published) === 1 } : null
})
