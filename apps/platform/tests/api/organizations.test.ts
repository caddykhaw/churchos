import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDbMock } from '../helpers/db-mock'

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  provisionSubdomain: vi.fn()
}))

vi.mock('../../server/utils/auth', () => ({ requireAuth: mocks.requireAuth }))
vi.mock('../../server/utils/cloudflare', () => ({ provisionSubdomain: mocks.provisionSubdomain }))

let db: ReturnType<typeof createDbMock>

vi.mock('../../server/utils/db', () => ({
  dbAll: (...args: unknown[]) => db.dbAll(...args as [string]),
  dbOne: (...args: unknown[]) => db.dbOne(...args as [string]),
  dbRun: (...args: unknown[]) => db.dbRun(...args as [string])
}))

vi.stubGlobal('defineEventHandler', <T>(callback: T) => callback)
const handler = (await import('../../server/api/organizations/index.post')).default

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
    mocks.requireAuth.mockReturnValue({ id: 'user-1', email: 'owner@example.com' })
    mocks.provisionSubdomain.mockResolvedValue(undefined)
    db = createDbMock()
    vi.stubGlobal('useRuntimeConfig', () => ({ public: { demoEmail: 'demo@churchos.my' } }))
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  it('rejects malformed slugs before querying the database', async () => {
    vi.stubGlobal('readBody', async () => ({ name: 'Grace Church', slug: '-leading-hyphen' }))

    await expect(handler({ context: {} } as never)).rejects.toSatisfy(error => {
      expectHttpError(error, 400, 'Slug must be 3-30 characters, lowercase letters, numbers, and hyphens only')
      return true
    })
    expect(db.dbOne).not.toHaveBeenCalled()
  })

  it.each(['api', 'localhost'])('rejects reserved slug %s', async (slug) => {
    vi.stubGlobal('readBody', async () => ({ name: 'Grace Church', slug }))

    await expect(handler({ context: {} } as never)).rejects.toSatisfy(error => {
      expectHttpError(error, 400, 'This name is reserved, please choose another')
      return true
    })
  })

  it('returns a conflict when the slug is already taken', async () => {
    db.dbOne.mockResolvedValue({ id: 'existing-org' })
    vi.stubGlobal('readBody', async () => ({ name: 'Grace Church', slug: 'grace-church' }))

    await expect(handler({ context: {} } as never)).rejects.toSatisfy(error => {
      expectHttpError(error, 409, 'This name is already taken')
      return true
    })
    expect(db.dbRun).not.toHaveBeenCalled()
  })

  it('creates an inactive organization, adds its creator as admin, and provisions its subdomain', async () => {
    const organization = { id: 'org-1', name: 'Grace Church', slug: 'grace-church', subscription_status: 'inactive' }
    db.dbOne
      .mockResolvedValueOnce(null) // slug availability check
      .mockResolvedValueOnce(organization) // final fetch
    vi.stubGlobal('readBody', async () => ({ name: 'Grace Church', slug: 'grace-church' }))

    await expect(handler({ context: {} } as never)).resolves.toEqual({
      organization,
      subdomain: 'grace-church.churchos.my'
    })
    expect(db.dbRun).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO organizations'), expect.arrayContaining(['grace-church', 'Grace Church']))
    expect(db.dbRun).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO organization_members'), expect.arrayContaining(['user-1']))
    expect(mocks.provisionSubdomain).toHaveBeenCalledWith('grace-church')
  })

  it('rolls back the organization when adding the creator as admin fails', async () => {
    db.dbOne.mockResolvedValueOnce(null) // slug availability check
    db.dbRun
      .mockResolvedValueOnce(1) // insert organization
      .mockRejectedValueOnce(new Error('FK violation')) // insert membership
    vi.stubGlobal('readBody', async () => ({ name: 'Grace Church', slug: 'grace-church' }))

    await expect(handler({ context: {} } as never)).rejects.toSatisfy(error => {
      expectHttpError(error, 500, 'Failed to add user as admin')
      return true
    })
    expect(db.dbRun).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM organizations'), [expect.any(String)])
    expect(mocks.provisionSubdomain).not.toHaveBeenCalled()
  })

  it('blocks the shared demo profile from creating workspaces', async () => {
    mocks.requireAuth.mockReturnValue({ id: 'demo-profile', email: 'demo@churchos.my' })
    vi.stubGlobal('readBody', async () => ({ name: 'Grace Church', slug: 'grace-church' }))

    await expect(handler({ context: {} } as never)).rejects.toSatisfy(error => {
      expectHttpError(error, 403, 'Organization creation is disabled in the demo sandbox')
      return true
    })
  })
})
