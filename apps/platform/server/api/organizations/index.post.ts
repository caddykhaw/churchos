import { requireAuth } from '../../utils/auth'
import { provisionSubdomain } from '../../utils/cloudflare'
import { useSupabaseAdmin } from '../../utils/supabase'

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
    && 'code' in error
    && error.code === '23505'
}

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)
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

  const admin = useSupabaseAdmin()
  const { data: existing, error: existingError } = await admin
    .from('organizations')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()

  if (existingError) {
    throw createError({
      statusCode: 500,
      message: 'Failed to check organization availability'
    })
  }

  if (existing) {
    throw createError({
      statusCode: 409,
      message: 'This name is already taken'
    })
  }

  const trialEndsAt = new Date()
  trialEndsAt.setDate(trialEndsAt.getDate() + 14)

  const { data: organization, error: organizationError } = await admin
    .from('organizations')
    .insert({
      name,
      slug,
      subscription_tier: 'starter',
      billing_cycle: 'monthly',
      subscribed_modules: [],
      trial_ends_at: trialEndsAt.toISOString(),
      subscription_status: 'trial',
      suspension_months: 0
    })
    .select()
    .single()

  // The database unique constraint remains the source of truth under concurrent requests.
  if (isUniqueViolation(organizationError)) {
    throw createError({
      statusCode: 409,
      message: 'This name is already taken'
    })
  }

  if (organizationError || !organization) {
    throw createError({
      statusCode: 500,
      message: 'Failed to create organization'
    })
  }

  const { error: memberError } = await admin
    .from('organization_members')
    .insert({
      organization_id: organization.id,
      user_id: user.id,
      roles: ['admin'],
      status: 'active'
    })

  if (memberError) {
    // Keep failed creation attempts from leaving an inaccessible organization behind.
    await admin.from('organizations').delete().eq('id', organization.id)
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

  return {
    organization,
    subdomain: `${slug}.churchos.my`
  }
})
