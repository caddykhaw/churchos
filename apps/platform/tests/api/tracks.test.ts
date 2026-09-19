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

const handler = (await import('../../server/api/journey/tracks/index.post')).default

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
    db = createDbMock()
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  it('rejects missing titles before querying the database', async () => {
    vi.stubGlobal('readBody', async () => ({ title_en: '' }))

    await expect(handler({} as never)).rejects.toSatisfy(error => {
      expectHttpError(error, 400, 'Track title is required')
      return true
    })
    expect(db.dbRun).not.toHaveBeenCalled()
  })

  it('creates a draft track scoped to the current organization by default', async () => {
    const track = { id: 'track-1', organization_id: 'org-1', title_en: 'Foundations', status: 'draft' }
    db.dbOne.mockResolvedValue(track)
    vi.stubGlobal('readBody', async () => ({ title_en: 'Foundations', description: 'Basics' }))

    await expect(handler({} as never)).resolves.toEqual(track)
    const [sql, args] = db.dbRun.mock.calls[0]!
    expect(String(sql)).toContain('INSERT INTO tracks')
    expect(args).toContain('org-1')
    expect(args).toContain('Foundations')
    expect(args).toContain('Basics')
    expect(args).toContain('draft')
  })

  it('honours an explicit published status', async () => {
    const track = { id: 'track-2', organization_id: 'org-1', title_en: 'Baptism Prep', status: 'published' }
    db.dbOne.mockResolvedValue(track)
    vi.stubGlobal('readBody', async () => ({ title_en: 'Baptism Prep', status: 'published' }))

    await expect(handler({} as never)).resolves.toEqual(track)
    expect(db.dbRun.mock.calls[0]![1]).toContain('published')
  })

  it('requires the admin role', async () => {
    db.dbOne.mockResolvedValue({ id: 'track-1' })
    vi.stubGlobal('readBody', async () => ({ title_en: 'Foundations' }))

    await handler({} as never)
    expect(mocks.requireModule).toHaveBeenCalledWith(expect.anything(), 'journey', { role: 'admin' })
  })
})
