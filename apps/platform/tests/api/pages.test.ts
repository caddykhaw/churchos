import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireModule: vi.fn(),
  useSupabaseAdmin: vi.fn()
}))

vi.mock('../../server/utils/auth', () => ({ requireModule: mocks.requireModule }))
vi.mock('../../server/utils/supabase', () => ({ useSupabaseAdmin: mocks.useSupabaseAdmin }))

vi.stubGlobal('defineEventHandler', <T>(callback: T) => callback)

const postHandler = (await import('../../server/api/pages/index.post')).default
const patchHandler = (await import('../../server/api/pages/[id].patch')).default
const getOneHandler = (await import('../../server/api/pages/[id].get')).default
const deleteHandler = (await import('../../server/api/pages/[id].delete')).default

type SupabaseResult<T> = { data: T, error: unknown }

const org = { id: 'org-1', slug: 'grace-church', name: 'Grace Church' }

function expectHttpError(error: unknown, statusCode: number, message: string) {
  expect(error).toMatchObject({ statusCode, message })
}

describe('POST /api/pages', () => {
  beforeEach(() => {
    vi.stubGlobal('createError', ({ statusCode, message }: { statusCode: number, message: string }) => {
      const error = new Error(message) as Error & { statusCode: number }
      error.statusCode = statusCode
      return error
    })
    mocks.requireModule.mockReturnValue(org)
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  it('rejects malformed slugs before querying the database', async () => {
    const admin = { from: vi.fn() }
    mocks.useSupabaseAdmin.mockReturnValue(admin)
    vi.stubGlobal('readBody', async () => ({ slug: 'Bad Slug!', title_en: 'Welcome' }))

    await expect(postHandler({} as never)).rejects.toSatisfy(error => {
      expectHttpError(error, 400, 'Slug must be lowercase letters, numbers, and hyphens only')
      return true
    })
    expect(admin.from).not.toHaveBeenCalled()
  })

  it('creates a page scoped to the current organization, unpublished by default', async () => {
    const page = { id: 'page-1', organization_id: 'org-1', slug: 'welcome', title_en: 'Welcome', published: false }
    const insert = vi.fn(() => ({
      select: () => ({
        single: async (): Promise<SupabaseResult<typeof page>> => ({ data: page, error: null })
      })
    }))
    mocks.useSupabaseAdmin.mockReturnValue({ from: vi.fn(() => ({ insert })) })
    vi.stubGlobal('readBody', async () => ({ slug: 'welcome', title_en: 'Welcome', title_zh: '欢迎' }))

    await expect(postHandler({} as never)).resolves.toEqual(page)
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      organization_id: 'org-1',
      slug: 'welcome',
      title_en: 'Welcome',
      title_zh: '欢迎',
      published: false
    }))
  })

  it('returns a conflict when the slug is already taken in the org', async () => {
    const insert = vi.fn(() => ({
      select: () => ({
        single: async (): Promise<SupabaseResult<null>> => ({
          data: null,
          error: { code: '23505' }
        })
      })
    }))
    mocks.useSupabaseAdmin.mockReturnValue({ from: vi.fn(() => ({ insert })) })
    vi.stubGlobal('readBody', async () => ({ slug: 'welcome', title_en: 'Welcome' }))

    await expect(postHandler({} as never)).rejects.toSatisfy(error => {
      expectHttpError(error, 409, 'A page with this slug already exists')
      return true
    })
  })
})

describe('PATCH /api/pages/:id', () => {
  beforeEach(() => {
    vi.stubGlobal('createError', ({ statusCode, message }: { statusCode: number, message: string }) => {
      const error = new Error(message) as Error & { statusCode: number }
      error.statusCode = statusCode
      return error
    })
    mocks.requireModule.mockReturnValue(org)
    vi.stubGlobal('getRouterParam', () => 'page-1')
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  it('toggles published and scopes the update to the organization', async () => {
    const page = { id: 'page-1', organization_id: 'org-1', slug: 'welcome', published: true }
    const eq = vi.fn(() => ({
      eq: vi.fn(() => ({
        select: () => ({
          single: async (): Promise<SupabaseResult<typeof page>> => ({ data: page, error: null })
        })
      }))
    }))
    const update = vi.fn(() => ({ eq }))
    mocks.useSupabaseAdmin.mockReturnValue({ from: vi.fn(() => ({ update })) })
    vi.stubGlobal('readBody', async () => ({ published: true }))

    await expect(patchHandler({} as never)).resolves.toEqual(page)
    expect(update).toHaveBeenCalledWith({ published: true })
    expect(eq).toHaveBeenCalledWith('id', 'page-1')
  })

  it('updates slug and titles with format validation', async () => {
    const page = { id: 'page-1', slug: 'about-us', title_en: 'About Us' }
    const eq = vi.fn(() => ({
      eq: vi.fn(() => ({
        select: () => ({
          single: async (): Promise<SupabaseResult<typeof page>> => ({ data: page, error: null })
        })
      }))
    }))
    const update = vi.fn(() => ({ eq }))
    mocks.useSupabaseAdmin.mockReturnValue({ from: vi.fn(() => ({ update })) })
    vi.stubGlobal('readBody', async () => ({ slug: 'About-Us', title_en: 'About Us' }))

    await expect(patchHandler({} as never)).resolves.toEqual(page)
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ slug: 'about-us', title_en: 'About Us' }))
  })

  it('rejects a malformed slug before touching the database', async () => {
    const admin = { from: vi.fn() }
    mocks.useSupabaseAdmin.mockReturnValue(admin)
    vi.stubGlobal('readBody', async () => ({ slug: 'Bad Slug!' }))

    await expect(patchHandler({} as never)).rejects.toSatisfy(error => {
      expectHttpError(error, 400, 'Slug must be lowercase letters, numbers, and hyphens (e.g. about-us)')
      return true
    })
    expect(admin.from).not.toHaveBeenCalled()
  })

  it('requires the admin role', async () => {
    const eq = vi.fn(() => ({
      eq: vi.fn(() => ({
        select: () => ({
          single: async (): Promise<SupabaseResult<null>> => ({ data: null, error: null })
        })
      }))
    }))
    mocks.useSupabaseAdmin.mockReturnValue({ from: vi.fn(() => ({ update: () => ({ eq }) })) })
    vi.stubGlobal('readBody', async () => ({ published: false }))

    await patchHandler({} as never)
    expect(mocks.requireModule).toHaveBeenCalledWith(expect.anything(), 'pages', { role: 'admin' })
  })
})

describe('GET /api/pages/:id', () => {
  beforeEach(() => {
    vi.stubGlobal('createError', ({ statusCode, message }: { statusCode: number, message: string }) => {
      const error = new Error(message) as Error & { statusCode: number }
      error.statusCode = statusCode
      return error
    })
    vi.stubGlobal('getRouterParam', (event: { params?: Record<string, string> }, name: string) => event?.params?.[name])
    mocks.requireModule.mockReturnValue(org)
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  it('returns a single org page', async () => {
    const page = { id: 'page-1', slug: 'welcome', title_en: 'Welcome' }
    const single = vi.fn(async (): Promise<SupabaseResult<typeof page>> => ({ data: page, error: null }))
    const eq = vi.fn(() => ({ eq: vi.fn(() => ({ single })) }))
    mocks.useSupabaseAdmin.mockReturnValue({ from: vi.fn(() => ({ select: () => ({ eq }) })) })

    await expect(getOneHandler({ params: { id: 'page-1' } } as never)).resolves.toEqual(page)
    expect(single).toHaveBeenCalled()
  })

  it('returns 404 for missing or cross-org pages', async () => {
    const single = vi.fn(async (): Promise<SupabaseResult<null>> => ({ data: null, error: { message: 'no rows' } }))
    const eq = vi.fn(() => ({ eq: vi.fn(() => ({ single })) }))
    mocks.useSupabaseAdmin.mockReturnValue({ from: vi.fn(() => ({ select: () => ({ eq }) })) })

    await expect(getOneHandler({ params: { id: 'nope' } } as never)).rejects.toSatisfy(error => {
      expectHttpError(error, 404, 'Page not found')
      return true
    })
  })
})

describe('DELETE /api/pages/:id', () => {
  beforeEach(() => {
    vi.stubGlobal('createError', ({ statusCode, message }: { statusCode: number, message: string }) => {
      const error = new Error(message) as Error & { statusCode: number }
      error.statusCode = statusCode
      return error
    })
    vi.stubGlobal('getRouterParam', (event: { params?: Record<string, string> }, name: string) => event?.params?.[name])
    mocks.requireModule.mockReturnValue(org)
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  it('deletes an unpublished page', async () => {
    const single = vi.fn(async (): Promise<SupabaseResult<{ id: string, published: boolean }>> => ({
      data: { id: 'page-1', published: false },
      error: null
    }))
    const selectSingle = vi.fn(() => ({ single }))
    const deleteEq = vi.fn(() => ({
      eq: vi.fn(async (): Promise<SupabaseResult<null>> => ({ data: null, error: null }))
    }))
    mocks.useSupabaseAdmin.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === 'pages' && selectSingle.mock.calls.length === 0) {
          return { select: () => ({ eq: () => ({ eq: selectSingle }) }) }
        }
        return { delete: () => ({ eq: deleteEq }) }
      })
    })

    await expect(deleteHandler({ params: { id: 'page-1' } } as never)).resolves.toEqual({ ok: true })
  })

  it('blocks deleting a published page', async () => {
    const single = vi.fn(async (): Promise<SupabaseResult<{ id: string, published: boolean }>> => ({
      data: { id: 'page-1', published: true },
      error: null
    }))
    mocks.useSupabaseAdmin.mockReturnValue({
      from: vi.fn(() => ({ select: () => ({ eq: () => ({ eq: () => ({ single }) }) }) }))
    })

    await expect(deleteHandler({ params: { id: 'page-1' } } as never)).rejects.toSatisfy(error => {
      expectHttpError(error, 409, 'Page is published. Unpublish it before deleting.')
      return true
    })
  })

  it('returns 404 when the page is missing or belongs to another org', async () => {
    const single = vi.fn(async (): Promise<SupabaseResult<null>> => ({ data: null, error: { message: 'no rows' } }))
    mocks.useSupabaseAdmin.mockReturnValue({
      from: vi.fn(() => ({ select: () => ({ eq: () => ({ eq: () => ({ single }) }) }) }))
    })

    await expect(deleteHandler({ params: { id: 'nope' } } as never)).rejects.toSatisfy(error => {
      expectHttpError(error, 404, 'Page not found')
      return true
    })
  })
})