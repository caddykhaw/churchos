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
vi.stubGlobal('createError', ({ statusCode, message }: { statusCode: number, message: string }) => {
  const error = new Error(message) as Error & { statusCode: number }
  error.statusCode = statusCode
  return error
})
vi.stubGlobal('getRouterParam', (event: { params?: Record<string, string> }, name: string) => event?.params?.[name])

const postHandler = (await import('../../server/api/people/index.post')).default
const getHandler = (await import('../../server/api/people/index.get')).default
const getOneHandler = (await import('../../server/api/people/[id].get')).default
const patchHandler = (await import('../../server/api/people/[id].patch')).default
const deleteHandler = (await import('../../server/api/people/[id].delete')).default

function expectHttpError(error: unknown, statusCode: number, message: string) {
  expect(error).toMatchObject({ statusCode, message })
}

const org = { id: 'org-1', slug: 'grace-church', name: 'Grace Church' }
const member = { id: 'member-1', organization_id: 'org-1', full_name: 'John Lim', email: 'john@example.com', member_status: 'active' }

describe('POST /api/people', () => {
  beforeEach(() => {
    mocks.requireModule.mockReturnValue(org)
    db = createDbMock()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('rejects missing names before querying the database', async () => {
    vi.stubGlobal('readBody', async () => ({ full_name: 'J' }))

    await expect(postHandler({} as never)).rejects.toSatisfy(error => {
      expectHttpError(error, 400, 'Full name is required')
      return true
    })
    expect(db.dbRun).not.toHaveBeenCalled()
  })

  it('creates a member scoped to the current organization', async () => {
    db.dbOne.mockResolvedValue(member)
    vi.stubGlobal('readBody', async () => ({ full_name: 'John Lim', email: 'john@example.com', gender: 'male' }))

    await expect(postHandler({} as never)).resolves.toEqual(member)
    expect(db.dbRun).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO members'), expect.arrayContaining(['org-1', 'John Lim', 'john@example.com', 'male', 'active']))
  })

  it('requires the admin role', async () => {
    db.dbOne.mockResolvedValue(member)
    vi.stubGlobal('readBody', async () => ({ full_name: 'John Lim' }))

    await postHandler({} as never)
    expect(mocks.requireModule).toHaveBeenCalledWith(expect.anything(), 'people', { role: 'admin' })
  })
})

describe('GET /api/people', () => {
  beforeEach(() => {
    mocks.requireModule.mockReturnValue(org)
    db = createDbMock()
    vi.stubGlobal('getQuery', () => ({}))
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('returns a paginated envelope of org members in name order', async () => {
    const members = [{ id: 'member-1', full_name: 'Ann' }, { id: 'member-2', full_name: 'Ben' }]
    db.dbAll.mockResolvedValue(members)
    db.dbOne.mockResolvedValue({ count: 2 })

    await expect(getHandler({} as never)).resolves.toEqual({
      data: members,
      total: 2,
      limit: 100,
      offset: 0
    })
    expect(db.dbAll).toHaveBeenCalledWith(expect.stringContaining('ORDER BY full_name'), expect.anything())
  })

  it('propagates status filter, search, and pagination to the query', async () => {
    db.dbAll.mockResolvedValue([member])
    db.dbOne.mockResolvedValue({ count: 1 })
    vi.stubGlobal('getQuery', () => ({ status: 'active', search: 'john', limit: '10', offset: '20' }))

    await getHandler({} as never)
    const [sql, args] = db.dbAll.mock.calls[0]!
    expect(String(sql)).toContain('member_status = ?')
    expect(String(sql)).toContain('LIKE ?')
    expect(String(sql)).toContain('LIMIT ? OFFSET ?')
    expect(args).toEqual(['org-1', 'active', '%john%', '%john%', 10, 20])
  })
})

describe('GET /api/people/:id', () => {
  beforeEach(() => {
    mocks.requireModule.mockReturnValue(org)
    db = createDbMock()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('returns a single org member', async () => {
    db.dbOne.mockResolvedValue(member)

    await expect(getOneHandler({ params: { id: 'member-1' } } as never)).resolves.toEqual(member)
    expect(db.dbOne).toHaveBeenCalledWith(expect.stringContaining('organization_id = ?'), ['member-1', 'org-1'])
  })

  it('returns 404 when the member is missing or belongs to another org', async () => {
    db.dbOne.mockResolvedValue(null)

    await expect(getOneHandler({ params: { id: 'other-org-member' } } as never)).rejects.toSatisfy(error => {
      expectHttpError(error, 404, 'Member not found')
      return true
    })
  })
})

describe('PATCH /api/people/:id', () => {
  beforeEach(() => {
    mocks.requireModule.mockReturnValue(org)
    db = createDbMock()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('applies editable fields and validates member_status', async () => {
    const updated = { ...member, full_name: 'John Tan', member_status: 'inactive' }
    db.dbRun.mockResolvedValue(1)
    db.dbOne.mockResolvedValue(updated)
    vi.stubGlobal('readBody', async () => ({ full_name: 'John Tan', email: 'john.tan@example.com', member_status: 'inactive' }))

    await expect(patchHandler({ params: { id: 'member-1' } } as never)).resolves.toEqual(updated)
    const [sql, args] = db.dbRun.mock.calls[0]!
    expect(String(sql)).toContain('full_name = ?')
    expect(String(sql)).toContain('organization_id = ?')
    expect(args).toContain('John Tan')
    expect(args).toContain('org-1')
  })

  it('rejects an unknown member_status before touching the database', async () => {
    vi.stubGlobal('readBody', async () => ({ member_status: 'banned' }))

    await expect(patchHandler({ params: { id: 'member-1' } } as never)).rejects.toSatisfy(error => {
      expectHttpError(error, 400, 'member_status must be one of: active, inactive, former')
      return true
    })
    expect(db.dbRun).not.toHaveBeenCalled()
  })

  it('rejects an empty patch', async () => {
    vi.stubGlobal('readBody', async () => ({}))

    await expect(patchHandler({ params: { id: 'member-1' } } as never)).rejects.toSatisfy(error => {
      expectHttpError(error, 400, 'Nothing to update')
      return true
    })
    expect(db.dbRun).not.toHaveBeenCalled()
  })

  it('returns 404 when the scoped update matches no row', async () => {
    db.dbRun.mockResolvedValue(0)
    vi.stubGlobal('readBody', async () => ({ full_name: 'John Tan' }))

    await expect(patchHandler({ params: { id: 'missing' } } as never)).rejects.toSatisfy(error => {
      expectHttpError(error, 404, 'Member not found')
      return true
    })
  })

  it('requires the admin role', async () => {
    db.dbRun.mockResolvedValue(1)
    db.dbOne.mockResolvedValue(member)
    vi.stubGlobal('readBody', async () => ({ full_name: 'John Tan' }))

    await patchHandler({ params: { id: 'member-1' } } as never)
    expect(mocks.requireModule).toHaveBeenCalledWith(expect.anything(), 'people', { role: 'admin' })
  })
})

describe('DELETE /api/people/:id', () => {
  beforeEach(() => {
    mocks.requireModule.mockReturnValue(org)
    db = createDbMock()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('archives the member (soft delete to former status)', async () => {
    const archived = { ...member, member_status: 'former' }
    db.dbRun.mockResolvedValue(1)
    db.dbOne.mockResolvedValue(archived)

    await expect(deleteHandler({ params: { id: 'member-1' } } as never)).resolves.toEqual(archived)
    const [sql] = db.dbRun.mock.calls[0]!
    expect(String(sql)).toContain("member_status = 'former'")
    expect(String(sql)).toContain("member_status != 'former'")
  })

  it('returns 404 when nothing was archived (already former or missing)', async () => {
    db.dbRun.mockResolvedValue(0)

    await expect(deleteHandler({ params: { id: 'member-1' } } as never)).rejects.toSatisfy(error => {
      expectHttpError(error, 404, 'Member not found')
      return true
    })
  })

  it('requires the admin role', async () => {
    db.dbRun.mockResolvedValue(1)
    db.dbOne.mockResolvedValue(member)

    await deleteHandler({ params: { id: 'member-1' } } as never)
    expect(mocks.requireModule).toHaveBeenCalledWith(expect.anything(), 'people', { role: 'admin' })
  })
})
