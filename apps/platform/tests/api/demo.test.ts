import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDbMock } from '../helpers/db-mock'

const mocks = vi.hoisted(() => ({
  provisionDemoSandbox: vi.fn(),
  ensureDemoProfile: vi.fn()
}))

vi.mock('../../server/utils/demo', () => ({
  provisionDemoSandbox: mocks.provisionDemoSandbox,
  ensureDemoProfile: mocks.ensureDemoProfile
}))

vi.mock('../../server/utils/session', () => ({
  signSessionToken: vi.fn(() => 'signed-token')
}))

let db: ReturnType<typeof createDbMock>

vi.mock('../../server/utils/db', () => ({
  dbAll: (...args: unknown[]) => db.dbAll(...args as [string]),
  dbOne: (...args: unknown[]) => db.dbOne(...args as [string]),
  dbRun: (...args: unknown[]) => db.dbRun(...args as [string])
}))

vi.stubGlobal('defineEventHandler', <T>(callback: T) => callback)
vi.stubGlobal('getCookie', (event: { cookies?: Record<string, string> }, name: string) => event?.cookies?.[name])
vi.stubGlobal('setCookie', vi.fn())
vi.stubGlobal('clientKey', () => 'test-key')
vi.stubGlobal('rateLimit', () => ({ allowed: true, remaining: 1, retryAfterSeconds: 0 }))

const resetHandler = (await import('../../server/api/demo/reset.post')).default
const cronHandler = (await import('../../server/api/cron/check-subscriptions.get')).default

function expectHttpError(error: unknown, statusCode: number, message: string) {
  expect(error).toMatchObject({ statusCode, message })
}

describe('POST /api/demo/reset', () => {
  beforeEach(() => {
    db = createDbMock()
    mocks.provisionDemoSandbox.mockResolvedValue({ id: 'org-new', name: 'Fresh Demo', slug: 'demo-x' })
    mocks.ensureDemoProfile.mockResolvedValue('demo-profile-1')
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('deletes only the current demo org and provisions a fresh sandbox', async () => {
    vi.stubGlobal('getCookie', () => 'org-old')

    await expect(resetHandler({} as never)).resolves.toEqual({
      ok: true,
      organization: { id: 'org-new', name: 'Fresh Demo' }
    })
    expect(mocks.provisionDemoSandbox).toHaveBeenCalledTimes(1)
    expect(db.dbRun).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM organizations'), ['org-old'])
  })

  it('provisions a sandbox even with no prior cookie', async () => {
    vi.stubGlobal('getCookie', () => undefined)

    await expect(resetHandler({} as never)).resolves.toMatchObject({ ok: true })
    expect(mocks.provisionDemoSandbox).toHaveBeenCalledTimes(1)
    expect(db.dbRun).not.toHaveBeenCalled()
  })
})

describe('GET /api/cron/check-subscriptions', () => {
  beforeEach(() => {
    db = createDbMock()
    vi.stubGlobal('createError', ({ statusCode, message }: { statusCode: number, message: string }) => {
      const error = new Error(message) as Error & { statusCode: number }
      error.statusCode = statusCode
      return error
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  it('sweeps demo orgs older than 24h and reports the count', async () => {
    db.dbAll.mockResolvedValue([{ id: 'org-stale-1' }, { id: 'org-stale-2' }])

    const result = await cronHandler({} as never) as { ok: boolean, results: { demoOrgSwept: number } }
    expect(result.ok).toBe(true)
    expect(result.results.demoOrgSwept).toBe(2)
    expect(db.dbRun).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM organizations'), ['org-stale-1'])
    expect(db.dbRun).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM organizations'), ['org-stale-2'])
  })

  it('sweeps nothing when all demo orgs are fresh', async () => {
    db.dbAll.mockResolvedValue([])

    const result = await cronHandler({} as never) as { ok: boolean, results: { demoOrgSwept: number } }
    expect(result.ok).toBe(true)
    expect(result.results.demoOrgSwept).toBe(0)
    expect(db.dbRun).not.toHaveBeenCalled()
  })

  it('throws 500 when the sweep query fails', async () => {
    db.dbAll.mockRejectedValue(new Error('db down'))

    await expect(cronHandler({} as never)).rejects.toSatisfy(error => {
      expectHttpError(error, 500, 'Cron sweep failed')
      return true
    })
  })
})
