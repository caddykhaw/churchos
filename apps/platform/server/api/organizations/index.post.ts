import { requireAuth } from '../../utils/auth'
import { provisionSubdomain } from '../../utils/cloudflare'
import { dbOne, dbRun } from '../../utils/db'

const SLUG_PATTERN = /^(?=.{3,30}$)[a-z0-9](?:[a-z0-9-]*[a-z0-9])$/
const RESERVED_SLUGS = new Set([
  'app',
  'www',
  'localhost',
  'api',
  'admin',
  'docs',
  'blog',
  'mail',
  'cdn',
  'static'
])

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'message' in error
    && typeof (error as { message?: unknown }).message === 'string'
    && (error as { message: string }).message.includes('UNIQUE constraint failed')
}

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)

  // The shared demo profile may not create its own workspaces — it explores
  // isolated sandbox orgs provisioned by the demo flow.
  const config = useRuntimeConfig()
  if (event.context.org?.is_demo || user.email === String(config.public.demoEmail || '')) {
    throw createError({
      statusCode: 403,
      message: 'Organization creation is disabled in the demo sandbox'
    })
  }

  const body = await readBody<{ name?: unknown, slug?: unknown }>(event)
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  const slug = typeof body?.slug === 'string' ? body.slug : ''

  if (!SLUG_PATTERN.test(slug)) {
    throw createError({
      statusCode: 400,
      message: 'Slug must be 3-30 characters, lowercase letters, numbers, and hyphens only'
    })
  }

  // Includes the subdomains reserved by the DNS utility plus application routes.
  if (RESERVED_SLUGS.has(slug)) {
    throw createError({
      statusCode: 400,
      message: 'This name is reserved, please choose another'
    })
  }

  if (name.length < 2) {
    throw createError({
      statusCode: 400,
      message: 'Organization name is required'
    })
  }

  const existing = await dbOne('SELECT id FROM organizations WHERE slug = ?', [slug])
  if (existing) {
    throw createError({
      statusCode: 409,
      message: 'This name is already taken'
    })
  }

  const orgId = crypto.randomUUID()
  try {
    await dbRun(
      `INSERT INTO organizations (id, slug, name, subscription_tier, billing_cycle, subscribed_modules,
                                  trial_ends_at, subscription_status, is_demo, suspension_months)
       VALUES (?, ?, ?, 'starter', 'monthly', '[]', NULL, 'inactive', 0, 0)`,
      [orgId, slug, name]
    )
  } catch (error) {
    // The database unique constraint remains the source of truth under concurrent requests.
    if (isUniqueViolation(error)) {
      throw createError({ statusCode: 409, message: 'This name is already taken' })
    }
    throw createError({ statusCode: 500, message: 'Failed to create organization' })
  }

  try {
    await dbRun(
      `INSERT INTO organization_members (id, organization_id, user_id, roles, status)
       VALUES (?, ?, ?, '["admin"]', 'active')`,
      [crypto.randomUUID(), orgId, user.id]
    )
  } catch {
    // Keep failed creation attempts from leaving an inaccessible organization behind.
    await dbRun('DELETE FROM organizations WHERE id = ?', [orgId])
    throw createError({
      statusCode: 500,
      message: 'Failed to add user as admin'
    })
  }

  try {
    await provisionSubdomain(slug)
  } catch {
    // DNS provisioning is retriable and must not invalidate a completed database creation.
  }

  const organization = await dbOne('SELECT * FROM organizations WHERE id = ?', [orgId])

  return {
    organization,
    subdomain: `${slug}.churchos.my`
  }
})
