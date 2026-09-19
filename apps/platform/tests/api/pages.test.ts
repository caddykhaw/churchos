import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDbMock } from '../helpers/db-mock'

const mocks = vi.hoisted(() => ({
  requireModule: vi.fn()
}))

vi.mock('../../server/utils/auth', () => ({ requireModule: mocks.requireModule }))

let db: ReturnType<typeof createDbMock>

vi.mock('../../server/utils/db', () => ({
  dbAll: (...args: unknown[]) => db.dbAll(...args as [string]),
  dbOne: (...args: unknown[]) => db.dbOne(...args as [string]),
  dbRun: (...args: unknown[]) => db.dbRun(...args as [string])
}))

vi.stubGlobal('defineEventHandler', <T>(callback: T) => callback)

const postHandler = (await import('../../server/api/pages/index.post')).default
const patchHandler = (await import('../../server/api/pages/[id].patch')).default
const getOneHandler = (await import('../../server/api/pages/[id].get')).default
const deleteHandler = (await import('../../server/api/pages/[id].delete')).default

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
    db = createDbMock()
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  it('rejects malformed slugs before querying the database', async () => {
    vi.stubGlobal('readBody', async () => ({ slug: 'Bad Slug!', title_en: 'Welcome' }))

    await expect(postHandler({} as never)).rejects.toSatisfy(error => {
      expectHttpError(error, 400, 'Slug must be lowercase letters, numbers, and hyphens only')
      return true
    })
    expect(db.dbRun).not.toHaveBeenCalled()
  })

  it('creates a page scoped to the current organization, unpublished by default', async () => {
    const page = { id: 'page-1', organization_id: 'org-1', slug: 'welcome', title_en: 'Welcome', published: 0 }
    db.dbOne.mockResolvedValue(page)
    vi.stubGlobal('readBody', async () => ({ slug: 'welcome', title_en: 'Welcome', title_zh: '欢迎' }))

    await expect(postHandler({} as never)).resolves.toEqual({ ...page, published: false })
    const [sql, args] = db.dbRun.mock.calls[0]!
    expect(String(sql)).toContain('INSERT INTO pages')
    expect(args).toContain('org-1')
    expect(args).toContain('welcome')
    expect(args).toContain('欢迎')
  })

  it('returns a conflict when the slug is already taken in the org', async () => {
    db.dbRun.mockRejectedValue(new Error('UNIQUE constraint failed: pages.organization_id, pages.slug'))
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
    db = createDbMock()
    vi.stubGlobal('getRouterParam', () => 'page-1')
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  it('toggles published and scopes the update to the organization', async () => {
    const page = { id: 'page-1', organization_id: 'org-1', slug: 'welcome', published: 1 }
    db.dbRun.mockResolvedValue(1)
    db.dbOne.mockResolvedValue(page)
    vi.stubGlobal('readBody', async () => ({ published: true }))

    await expect(patchHandler({} as never)).resolves.toEqual({ ...page, published: true })
    const [sql, args] = db.dbRun.mock.calls[0]!
    expect(String(sql)).toContain('published = ?')
    expect(String(sql)).toContain('organization_id = ?')
    expect(args).toContain(1)
  })

  it('updates slug and titles with format validation', async () => {
    const page = { id: 'page-1', slug: 'about-us', title_en: 'About Us', published: 0 }
    db.dbRun.mockResolvedValue(1)
    db.dbOne.mockResolvedValue(page)
    vi.stubGlobal('readBody', async () => ({ slug: 'About-Us', title_en: 'About Us' }))

    await expect(patchHandler({} as never)).resolves.toEqual({ ...page, published: false })
    const [sql, args] = db.dbRun.mock.calls[0]!
    expect(String(sql)).toContain('slug = ?')
    expect(args).toContain('about-us')
  })

  it('rejects a malformed slug before touching the database', async () => {
    vi.stubGlobal('readBody', async () => ({ slug: 'Bad Slug!' }))

    await expect(patchHandler({} as never)).rejects.toSatisfy(error => {
      expectHttpError(error, 400, 'Slug must be lowercase letters, numbers, and hyphens (e.g. about-us)')
      return true
    })
    expect(db.dbRun).not.toHaveBeenCalled()
  })

  it('requires the admin role', async () => {
    db.dbRun.mockResolvedValue(1)
    db.dbOne.mockResolvedValue({ id: 'page-1', published: 0 })
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
    db = createDbMock()
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  it('returns a single org page', async () => {
    const page = { id: 'page-1', slug: 'welcome', title_en: 'Welcome', published: 0 }
    db.dbOne.mockResolvedValue(page)

    await expect(getOneHandler({ params: { id: 'page-1' } } as never)).resolves.toEqual({ ...page, published: false })
    expect(db.dbOne).toHaveBeenCalledWith(expect.stringContaining('organization_id = ?'), ['page-1', 'org-1'])
  })

  it('returns 404 for missing or cross-org pages', async () => {
    db.dbOne.mockResolvedValue(null)

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
    db = createDbMock()
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  it('deletes an unpublished page', async () => {
    db.dbOne.mockResolvedValue({ id: 'page-1', published: 0 })

    await expect(deleteHandler({ params: { id: 'page-1' } } as never)).resolves.toEqual({ ok: true })
    expect(db.dbRun).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM pages'), ['page-1', 'org-1'])
  })

  it('blocks deleting a published page', async () => {
    db.dbOne.mockResolvedValue({ id: 'page-1', published: 1 })

    await expect(deleteHandler({ params: { id: 'page-1' } } as never)).rejects.toSatisfy(error => {
      expectHttpError(error, 409, 'Page is published. Unpublish it before deleting.')
      return true
    })
  })

  it('returns 404 when the page is missing or belongs to another org', async () => {
    db.dbOne.mockResolvedValue(null)

    await expect(deleteHandler({ params: { id: 'nope' } } as never)).rejects.toSatisfy(error => {
      expectHttpError(error, 404, 'Page not found')
      return true
    })
  })
})
