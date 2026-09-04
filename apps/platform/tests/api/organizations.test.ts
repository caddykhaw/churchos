import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  useSupabaseAdmin: vi.fn(),
  provisionSubdomain: vi.fn()
}))

vi.mock('../../server/utils/auth', () => ({ requireAuth: mocks.requireAuth }))
vi.mock('../../server/utils/supabase', () => ({ useSupabaseAdmin: mocks.useSupabaseAdmin }))
vi.mock('../../server/utils/cloudflare', () => ({ provisionSubdomain: mocks.provisionSubdomain }))

vi.stubGlobal('defineEventHandler', <T>(callback: T) => callback)
const handler = (await import('../../server/api/organizations/index.post')).default

type SupabaseResult<T> = { data: T, error: unknown }

function createAdmin({
  existing = null as { id: string } | null,
  organization = { id: 'org-1', name: 'Grace Church', slug: 'grace-church' },
  organizationError = null,
  membershipError = null
}: {
  existing?: { id: string } | null
  organization?: { id: string, name: string, slug: string }
  organizationError?: unknown
  membershipError?: unknown
} = {}) {
  const organizationInsert = vi.fn(() => ({
    select: () => ({
      single: async (): Promise<SupabaseResult<typeof organization>> => ({
        data: organizationError ? null : organization,
        error: organizationError
      })
    })
  }))
  const membershipInsert = vi.fn(async (): Promise<SupabaseResult<null>> => ({
    data: null,
    error: membershipError
  }))
  const organizationDelete = vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) }))

  return {
    from: vi.fn((table: string) => {
      if (table === 'organizations') {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async (): Promise<SupabaseResult<typeof existing>> => ({ data: existing, error: null }) })
          }),
          insert: organizationInsert,
          delete: organizationDelete
        }
      }

      return { insert: membershipInsert }
    }),
    organizationInsert,
    membershipInsert,
    organizationDelete
  }
}

function expectHttpError(error: unknown, statusCode: number, message: string) {
  expect(error).toMatchObject({ statusCode, message })
}

describe('POST /api/organizations', () => {
  beforeEach(() => {
    vi.stubGlobal('defineEventHandler', <T>(callback: T) => callback)
    vi.stubGlobal('createError', ({ statusCode, message }: { statusCode: number, message: string }) => {
      const error = new Error(message) as Error & { statusCode: number }
      error.statusCode = statusCode
      return error
    })
    mocks.requireAuth.mockReturnValue({ id: 'user-1' })
    mocks.provisionSubdomain.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  it('rejects malformed slugs before querying the database', async () => {
    const admin = createAdmin()
    mocks.useSupabaseAdmin.mockReturnValue(admin)
    vi.stubGlobal('useRuntimeConfig', () => ({ public: { demoEmail: '' } }))
    vi.stubGlobal('readBody', async () => ({ name: 'Grace Church', slug: '-leading-hyphen' }))

    await expect(handler({ context: {} } as never)).rejects.toSatisfy(error => {
      expectHttpError(error, 400, 'Slug must be 3-30 characters, lowercase letters, numbers, and hyphens only')
      return true
    })
    expect(mocks.useSupabaseAdmin).not.toHaveBeenCalled()
  })

  it.each(['api', 'localhost'])('rejects reserved slug %s', async (slug) => {
    vi.stubGlobal('useRuntimeConfig', () => ({ public: { demoEmail: '' } }))
    vi.stubGlobal('readBody', async () => ({ name: 'Grace Church', slug }))

    await expect(handler({ context: {} } as never)).rejects.toSatisfy(error => {
      expectHttpError(error, 400, 'This name is reserved, please choose another')
      return true
    })
  })

  it('returns a conflict when the slug is already taken', async () => {
    const admin = createAdmin({ existing: { id: 'existing-org' } })
    mocks.useSupabaseAdmin.mockReturnValue(admin)
    vi.stubGlobal('useRuntimeConfig', () => ({ public: { demoEmail: '' } }))
    vi.stubGlobal('readBody', async () => ({ name: 'Grace Church', slug: 'grace-church' }))

    await expect(handler({ context: {} } as never)).rejects.toSatisfy(error => {
      expectHttpError(error, 409, 'This name is already taken')
      return true
    })
    expect(admin.organizationInsert).not.toHaveBeenCalled()
  })

  it('creates an inactive organization, adds its creator as admin, and provisions its subdomain', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-27T00:00:00.000Z'))
    const admin = createAdmin()
    mocks.useSupabaseAdmin.mockReturnValue(admin)
    vi.stubGlobal('useRuntimeConfig', () => ({ public: { demoEmail: '' } }))
    vi.stubGlobal('readBody', async () => ({ name: 'Grace Church', slug: 'grace-church' }))

    await expect(handler({ context: {} } as never)).resolves.toEqual({
      organization: { id: 'org-1', name: 'Grace Church', slug: 'grace-church' },
      subdomain: 'grace-church.churchos.my'
    })
    expect(admin.organizationInsert).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Grace Church',
      slug: 'grace-church',
      subscription_tier: 'starter',
      billing_cycle: 'monthly',
      subscribed_modules: [],
      trial_ends_at: null,
      subscription_status: 'inactive',
      is_demo: false,
      suspension_months: 0
    }))
    expect(admin.membershipInsert).toHaveBeenCalledWith({
      organization_id: 'org-1',
      user_id: 'user-1',
      roles: ['admin'],
      status: 'active'
    })
    expect(mocks.provisionSubdomain).toHaveBeenCalledWith('grace-church')
  })

  it('rolls back the organization when adding the creator as admin fails', async () => {
    const admin = createAdmin({ membershipError: { code: '23503' } })
    mocks.useSupabaseAdmin.mockReturnValue(admin)
    vi.stubGlobal('useRuntimeConfig', () => ({ public: { demoEmail: '' } }))
    vi.stubGlobal('readBody', async () => ({ name: 'Grace Church', slug: 'grace-church' }))

    await expect(handler({ context: {} } as never)).rejects.toSatisfy(error => {
      expectHttpError(error, 500, 'Failed to add user as admin')
      return true
    })
    expect(admin.organizationDelete).toHaveBeenCalledWith()
    expect(mocks.provisionSubdomain).not.toHaveBeenCalled()
  })
})
