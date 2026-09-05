import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireModule: vi.fn(),
  useSupabaseAdmin: vi.fn()
}))

vi.mock('../../server/utils/auth', () => ({ requireModule: mocks.requireModule }))
vi.mock('../../server/utils/supabase', () => ({ useSupabaseAdmin: mocks.useSupabaseAdmin }))

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

type SupabaseResult<T> = { data: T, error: unknown }

/**
 * Universal chainable Supabase builder mock: every chained method returns the
 * same object; awaiting it (list queries) or calling .single() resolves to the
 * configured final result. Method calls are recorded for assertions.
 */
function createBuilder(final: SupabaseResult<unknown>) {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {}
  for (const method of ['select', 'eq', 'order', 'range', 'or', 'neq', 'update', 'insert']) {
    builder[method] = vi.fn(() => builder)
  }
  builder.single = vi.fn(async (): Promise<SupabaseResult<unknown>> => final)
  // Make the builder awaitable for list-style queries.
  Object.defineProperty(builder, 'then', {
    value: (
      onFulfilled: (value: SupabaseResult<unknown>) => unknown,
      onRejected: (reason: unknown) => unknown
    ) => Promise.resolve(final).then(onFulfilled, onRejected),
    writable: true
  })
  return builder
}

function createAdmin(final: SupabaseResult<unknown>) {
  const builder = createBuilder(final)
  return {
    from: vi.fn(() => builder),
    builder
  }
}

function expectHttpError(error: unknown, statusCode: number, message: string) {
  expect(error).toMatchObject({ statusCode, message })
}

const org = { id: 'org-1', slug: 'grace-church', name: 'Grace Church' }
const member = { id: 'member-1', organization_id: 'org-1', full_name: 'John Lim', email: 'john@example.com', member_status: 'active' }

describe('POST /api/people', () => {
  beforeEach(() => {
    mocks.requireModule.mockReturnValue(org)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('rejects missing names before querying the database', async () => {
    const admin = createAdmin({ data: null, error: null })
    mocks.useSupabaseAdmin.mockReturnValue(admin)
    vi.stubGlobal('readBody', async () => ({ full_name: 'J' }))

    await expect(postHandler({} as never)).rejects.toSatisfy(error => {
      expectHttpError(error, 400, 'Full name is required')
      return true
    })
    expect(admin.builder.insert).not.toHaveBeenCalled()
  })

  it('creates a member scoped to the current organization', async () => {
    const admin = createAdmin({ data: member, error: null })
    mocks.useSupabaseAdmin.mockReturnValue(admin)
    vi.stubGlobal('readBody', async () => ({ full_name: 'John Lim', email: 'john@example.com', gender: 'male' }))

    await expect(postHandler({} as never)).resolves.toEqual(member)
    expect(admin.builder.insert).toHaveBeenCalledWith(expect.objectContaining({
      organization_id: 'org-1',
      full_name: 'John Lim',
      email: 'john@example.com',
      gender: 'male',
      member_status: 'active'
    }))
  })

  it('requires the admin role', async () => {
    const admin = createAdmin({ data: member, error: null })
    mocks.useSupabaseAdmin.mockReturnValue(admin)
    vi.stubGlobal('readBody', async () => ({ full_name: 'John Lim' }))

    await postHandler({} as never)
    expect(mocks.requireModule).toHaveBeenCalledWith(expect.anything(), 'people', { role: 'admin' })
  })
})

describe('GET /api/people', () => {
  beforeEach(() => {
    mocks.requireModule.mockReturnValue(org)
    vi.stubGlobal('getQuery', () => ({}))
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('returns a paginated envelope of org members in name order', async () => {
    const members = [{ id: 'member-1', full_name: 'Ann' }, { id: 'member-2', full_name: 'Ben' }]
    const admin = createBuilder({ data: members, error: null, count: 2 })
    mocks.useSupabaseAdmin.mockReturnValue({ from: () => admin })

    await expect(getHandler({} as never)).resolves.toEqual({
      data: members,
      total: 2,
      limit: 100,
      offset: 0
    })
    expect(admin.select).toHaveBeenCalledWith('*', { count: 'exact' })
    expect(admin.order).toHaveBeenCalledWith('full_name', { ascending: true })
    expect(admin.range).toHaveBeenCalledWith(0, 99)
  })

  it('propagates status filter, search, and pagination to the database', async () => {
    const admin = createBuilder({ data: [member], error: null, count: 1 })
    mocks.useSupabaseAdmin.mockReturnValue({ from: () => admin })
    vi.stubGlobal('getQuery', () => ({ status: 'active', search: 'john', limit: '10', offset: '20' }))

    await getHandler({} as never)
    expect(admin.eq).toHaveBeenCalledWith('member_status', 'active')
    expect(admin.or).toHaveBeenCalledWith('full_name.ilike.%john%,email.ilike.%john%')
    expect(admin.range).toHaveBeenCalledWith(20, 29)
  })
})

describe('GET /api/people/:id', () => {
  beforeEach(() => {
    mocks.requireModule.mockReturnValue(org)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('returns a single org member', async () => {
    const admin = createAdmin({ data: member, error: null })
    mocks.useSupabaseAdmin.mockReturnValue(admin)

    await expect(getOneHandler({ params: { id: 'member-1' } } as never)).resolves.toEqual(member)
    expect(admin.builder.eq).toHaveBeenCalledWith('id', 'member-1')
    expect(admin.builder.eq).toHaveBeenCalledWith('organization_id', 'org-1')
  })

  it('returns 404 when the member is missing or belongs to another org', async () => {
    const admin = createAdmin({ data: null, error: { message: 'no rows' } })
    mocks.useSupabaseAdmin.mockReturnValue(admin)

    await expect(getOneHandler({ params: { id: 'other-org-member' } } as never)).rejects.toSatisfy(error => {
      expectHttpError(error, 404, 'Member not found')
      return true
    })
  })
})

describe('PATCH /api/people/:id', () => {
  beforeEach(() => {
    mocks.requireModule.mockReturnValue(org)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('applies editable fields and validates member_status', async () => {
    const updated = { ...member, full_name: 'John Tan', member_status: 'inactive' }
    const admin = createAdmin({ data: updated, error: null })
    mocks.useSupabaseAdmin.mockReturnValue(admin)
    vi.stubGlobal('readBody', async () => ({ full_name: 'John Tan', email: 'john.tan@example.com', member_status: 'inactive' }))

    await expect(patchHandler({ params: { id: 'member-1' } } as never)).resolves.toEqual(updated)
    expect(admin.builder.update).toHaveBeenCalledWith(expect.objectContaining({
      full_name: 'John Tan',
      email: 'john.tan@example.com',
      member_status: 'inactive'
    }))
    expect(admin.builder.eq).toHaveBeenCalledWith('organization_id', 'org-1')
  })

  it('rejects an unknown member_status before touching the database', async () => {
    const admin = createAdmin({ data: null, error: null })
    mocks.useSupabaseAdmin.mockReturnValue(admin)
    vi.stubGlobal('readBody', async () => ({ member_status: 'banned' }))

    await expect(patchHandler({ params: { id: 'member-1' } } as never)).rejects.toSatisfy(error => {
      expectHttpError(error, 400, 'member_status must be one of: active, inactive, former')
      return true
    })
    expect(admin.builder.update).not.toHaveBeenCalled()
  })

  it('rejects an empty patch', async () => {
    const admin = createAdmin({ data: null, error: null })
    mocks.useSupabaseAdmin.mockReturnValue(admin)
    vi.stubGlobal('readBody', async () => ({}))

    await expect(patchHandler({ params: { id: 'member-1' } } as never)).rejects.toSatisfy(error => {
      expectHttpError(error, 400, 'Nothing to update')
      return true
    })
    expect(admin.builder.update).not.toHaveBeenCalled()
  })

  it('returns 404 when the scoped update matches no row', async () => {
    const admin = createAdmin({ data: null, error: { message: 'no rows' } })
    mocks.useSupabaseAdmin.mockReturnValue(admin)
    vi.stubGlobal('readBody', async () => ({ full_name: 'John Tan' }))

    await expect(patchHandler({ params: { id: 'missing' } } as never)).rejects.toSatisfy(error => {
      expectHttpError(error, 404, 'Member not found')
      return true
    })
  })

  it('requires the admin role', async () => {
    const admin = createAdmin({ data: member, error: null })
    mocks.useSupabaseAdmin.mockReturnValue(admin)
    vi.stubGlobal('readBody', async () => ({ full_name: 'John Tan' }))

    await patchHandler({ params: { id: 'member-1' } } as never)
    expect(mocks.requireModule).toHaveBeenCalledWith(expect.anything(), 'people', { role: 'admin' })
  })
})

describe('DELETE /api/people/:id', () => {
  beforeEach(() => {
    mocks.requireModule.mockReturnValue(org)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('archives the member (soft delete to former status)', async () => {
    const archived = { ...member, member_status: 'former' }
    const admin = createAdmin({ data: archived, error: null })
    mocks.useSupabaseAdmin.mockReturnValue(admin)

    await expect(deleteHandler({ params: { id: 'member-1' } } as never)).resolves.toEqual(archived)
    expect(admin.builder.update).toHaveBeenCalledWith({ member_status: 'former' })
    expect(admin.builder.neq).toHaveBeenCalledWith('member_status', 'former')
  })

  it('returns 404 when nothing was archived (already former or missing)', async () => {
    const admin = createAdmin({ data: null, error: { message: 'no rows' } })
    mocks.useSupabaseAdmin.mockReturnValue(admin)

    await expect(deleteHandler({ params: { id: 'member-1' } } as never)).rejects.toSatisfy(error => {
      expectHttpError(error, 404, 'Member not found')
      return true
    })
  })

  it('requires the admin role', async () => {
    const admin = createAdmin({ data: member, error: null })
    mocks.useSupabaseAdmin.mockReturnValue(admin)

    await deleteHandler({ params: { id: 'member-1' } } as never)
    expect(mocks.requireModule).toHaveBeenCalledWith(expect.anything(), 'people', { role: 'admin' })
  })
})
