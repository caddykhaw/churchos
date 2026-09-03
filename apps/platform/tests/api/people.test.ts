import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireModule: vi.fn(),
  useSupabaseAdmin: vi.fn()
}))

vi.mock('../../server/utils/auth', () => ({ requireModule: mocks.requireModule }))
vi.mock('../../server/utils/supabase', () => ({ useSupabaseAdmin: mocks.useSupabaseAdmin }))

vi.stubGlobal('defineEventHandler', <T>(callback: T) => callback)

const postHandler = (await import('../../server/api/people/index.post')).default
const getHandler = (await import('../../server/api/people/index.get')).default

type SupabaseResult<T> = { data: T, error: unknown }

function createAdmin({
  members = [] as unknown[],
  insertResult = null as unknown,
  insertError = null,
  listError = null
}: {
  members?: unknown[]
  insertResult?: unknown
  insertError?: unknown
  listError?: unknown
} = {}) {
  const memberInsert = vi.fn(() => ({
    select: () => ({
      single: async (): Promise<SupabaseResult<typeof insertResult>> => ({
        data: insertError ? null : insertResult,
        error: insertError
      })
    })
  }))

  // GET chain: .select('*') -> .eq(org) -> .order(name); with search, .or() is appended.
  const order = vi.fn((_column: string, _opts?: unknown) => {
    if (withSearch) {
      return {
        or: vi.fn(async (): Promise<SupabaseResult<unknown[]>> => ({
          data: listError ? null : members,
          error: listError
        }))
      }
    }
    return { data: listError ? null : members, error: listError }
  })
  const eq = vi.fn(() => ({ order }))
  const listSelect = vi.fn(() => ({ eq }))
  let withSearch = false

  return {
    from: vi.fn((table: string) => {
      if (table === 'members') {
        return {
          select: vi.fn((_columns?: string) => {
            if (_columns === undefined || _columns === '*') {
              return { eq }
            }
            return listSelect()
          }),
          insert: memberInsert
        }
      }
      return { select: listSelect, insert: memberInsert }
    }),
    setSearch: (enabled: boolean) => { withSearch = enabled },
    memberInsert,
    listSelect,
    order
  }
}

function expectHttpError(error: unknown, statusCode: number, message: string) {
  expect(error).toMatchObject({ statusCode, message })
}

const org = { id: 'org-1', slug: 'grace-church', name: 'Grace Church' }

describe('POST /api/people', () => {
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

  it('rejects missing names before querying the database', async () => {
    const admin = createAdmin()
    mocks.useSupabaseAdmin.mockReturnValue(admin)
    vi.stubGlobal('readBody', async () => ({ full_name: 'J' }))

    await expect(postHandler({} as never)).rejects.toSatisfy(error => {
      expectHttpError(error, 400, 'Full name is required')
      return true
    })
    expect(admin.memberInsert).not.toHaveBeenCalled()
  })

  it('creates a member scoped to the current organization', async () => {
    const member = { id: 'member-1', organization_id: 'org-1', full_name: 'John Lim', email: 'john@example.com' }
    const admin = createAdmin({ insertResult: member })
    mocks.useSupabaseAdmin.mockReturnValue(admin)
    vi.stubGlobal('readBody', async () => ({ full_name: 'John Lim', email: 'john@example.com', gender: 'male' }))

    await expect(postHandler({} as never)).resolves.toEqual(member)
    expect(admin.memberInsert).toHaveBeenCalledWith(expect.objectContaining({
      organization_id: 'org-1',
      full_name: 'John Lim',
      email: 'john@example.com',
      gender: 'male',
      member_status: 'active'
    }))
  })
})

describe('GET /api/people', () => {
  beforeEach(() => {
    vi.stubGlobal('createError', ({ statusCode, message }: { statusCode: number, message: string }) => {
      const error = new Error(message) as Error & { statusCode: number }
      error.statusCode = statusCode
      return error
    })
    mocks.requireModule.mockReturnValue(org)
    vi.stubGlobal('getQuery', () => ({}))
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  it('returns the org members in name order', async () => {
    const members = [{ id: 'member-1', full_name: 'Ann' }, { id: 'member-2', full_name: 'Ben' }]
    const admin = createAdmin({ members })
    mocks.useSupabaseAdmin.mockReturnValue(admin)

    await expect(getHandler({} as never)).resolves.toEqual(members)
    expect(admin.from).toHaveBeenCalledWith('members')
  })

  it('propagates a search query to the database', async () => {
    const admin = createAdmin({ members: [{ id: 'member-1', full_name: 'John Lim' }] })
    admin.setSearch(true)
    mocks.useSupabaseAdmin.mockReturnValue(admin)
    vi.stubGlobal('getQuery', () => ({ search: 'john' }))

    await expect(getHandler({} as never)).resolves.toEqual([{ id: 'member-1', full_name: 'John Lim' }])
    expect(admin.order).toHaveBeenCalled()
    expect(admin.order).toHaveReturnedWith(expect.objectContaining({ or: expect.any(Function) }))
  })
})