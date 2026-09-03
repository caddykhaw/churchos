import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireModule: vi.fn(),
  useSupabaseAdmin: vi.fn()
}))

vi.mock('../../server/utils/auth', () => ({ requireModule: mocks.requireModule }))
vi.mock('../../server/utils/supabase', () => ({ useSupabaseAdmin: mocks.useSupabaseAdmin }))

vi.stubGlobal('defineEventHandler', <T>(callback: T) => callback)

const handler = (await import('../../server/api/journey/tracks/index.post')).default

type SupabaseResult<T> = { data: T, error: unknown }

const org = { id: 'org-1', slug: 'grace-church', name: 'Grace Church' }

function expectHttpError(error: unknown, statusCode: number, message: string) {
  expect(error).toMatchObject({ statusCode, message })
}

describe('POST /api/journey/tracks', () => {
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

  it('rejects missing titles before querying the database', async () => {
    const admin = { from: vi.fn() }
    mocks.useSupabaseAdmin.mockReturnValue(admin)
    vi.stubGlobal('readBody', async () => ({ title_en: '' }))

    await expect(handler({} as never)).rejects.toSatisfy(error => {
      expectHttpError(error, 400, 'Track title is required')
      return true
    })
    expect(admin.from).not.toHaveBeenCalled()
  })

  it('creates a draft track scoped to the current organization by default', async () => {
    const track = { id: 'track-1', organization_id: 'org-1', title_en: 'Foundations', status: 'draft' }
    const insert = vi.fn(() => ({
      select: () => ({
        single: async (): Promise<SupabaseResult<typeof track>> => ({ data: track, error: null })
      })
    }))
    mocks.useSupabaseAdmin.mockReturnValue({ from: vi.fn(() => ({ insert })) })
    vi.stubGlobal('readBody', async () => ({ title_en: 'Foundations', description: 'Basics' }))

    await expect(handler({} as never)).resolves.toEqual(track)
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      organization_id: 'org-1',
      title_en: 'Foundations',
      description: 'Basics',
      status: 'draft'
    }))
  })

  it('honours an explicit published status', async () => {
    const track = { id: 'track-2', organization_id: 'org-1', title_en: 'Baptism Prep', status: 'published' }
    const insert = vi.fn(() => ({
      select: () => ({
        single: async (): Promise<SupabaseResult<typeof track>> => ({ data: track, error: null })
      })
    }))
    mocks.useSupabaseAdmin.mockReturnValue({ from: vi.fn(() => ({ insert })) })
    vi.stubGlobal('readBody', async () => ({ title_en: 'Baptism Prep', status: 'published' }))

    await expect(handler({} as never)).resolves.toEqual(track)
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ status: 'published' }))
  })
})