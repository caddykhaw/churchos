import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  provisionDemoSandbox: vi.fn(),
  signInDemoUser: vi.fn(),
  useSupabaseAdmin: vi.fn()
}))

vi.mock('../../server/utils/demo', () => ({
  provisionDemoSandbox: mocks.provisionDemoSandbox,
  signInDemoUser: mocks.signInDemoUser
}))
vi.mock('../../server/utils/supabase', () => ({ useSupabaseAdmin: mocks.useSupabaseAdmin }))

vi.stubGlobal('defineEventHandler', <T>(callback: T) => callback)
vi.stubGlobal('getCookie', (event: { cookies?: Record<string, string> }, name: string) => event?.cookies?.[name])
vi.stubGlobal('setCookie', () => {})

const resetHandler = (await import('../../server/api/demo/reset.post')).default
const cronHandler = (await import('../../server/api/cron/check-subscriptions.get')).default

function expectHttpError(error: unknown, statusCode: number, message: string) {
  expect(error).toMatchObject({ statusCode, message })
}

describe('POST /api/demo/reset', () => {
  beforeEach(() => {
    mocks.provisionDemoSandbox.mockResolvedValue({ id: 'org-new', name: 'Fresh Demo' })
    mocks.signInDemoUser.mockResolvedValue('token-abc')
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('deletes only the current demo org and provisions a fresh sandbox', async () => {
    const deleteEqFinal = vi.fn(async () => ({ data: null, error: null }))
    const deleteEqScope = vi.fn(() => ({ eq: deleteEqFinal }))
    const deleteEq = vi.fn(() => ({ eq: deleteEqScope }))
    const from = vi.fn(() => ({ delete: () => ({ eq: deleteEq }) }))
    mocks.useSupabaseAdmin.mockReturnValue({ from })

    vi.stubGlobal('getCookie', () => 'org-old')

    await expect(resetHandler({} as never)).resolves.toEqual({
      ok: true,
      organization: { id: 'org-new', name: 'Fresh Demo' }
    })
    expect(mocks.provisionDemoSandbox).toHaveBeenCalledTimes(1)
    expect(mocks.signInDemoUser).toHaveBeenCalledTimes(1)
    expect(deleteEq).toHaveBeenCalledWith('id', 'org-old')
    expect(deleteEqScope).toHaveBeenCalledWith('is_demo', true)
  })

  it('provisions a sandbox even with no prior cookie', async () => {
    const from = vi.fn()
    mocks.useSupabaseAdmin.mockReturnValue({ from })

    vi.stubGlobal('getCookie', () => undefined)

    await expect(resetHandler({} as never)).resolves.toMatchObject({ ok: true })
    expect(mocks.provisionDemoSandbox).toHaveBeenCalledTimes(1)
    expect(from).not.toHaveBeenCalled()
  })
})

describe('GET /api/cron/check-subscriptions', () => {
  beforeEach(() => {
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
    const stale = [{ id: 'org-stale-1' }, { id: 'org-stale-2' }]
    const deleteEq = vi.fn(async () => ({ data: null, error: null }))
    const lt = vi.fn(async () => ({ data: stale, error: null }))
    const from = vi.fn(() => ({
      select: () => ({ eq: () => ({ lt }) }),
      delete: () => ({ eq: deleteEq })
    }))
    mocks.useSupabaseAdmin.mockReturnValue({ from })

    const result = await cronHandler({} as never) as { ok: boolean, results: { demoOrgSwept: number } }
    expect(result.ok).toBe(true)
    expect(result.results.demoOrgSwept).toBe(2)
    expect(deleteEq).toHaveBeenCalledWith('id', 'org-stale-1')
    expect(deleteEq).toHaveBeenCalledWith('id', 'org-stale-2')
  })

  it('sweeps nothing when all demo orgs are fresh', async () => {
    const deleteEq = vi.fn()
    const lt = vi.fn(async () => ({ data: [], error: null }))
    const from = vi.fn(() => ({
      select: () => ({ eq: () => ({ lt }) }),
      delete: () => ({ eq: deleteEq })
    }))
    mocks.useSupabaseAdmin.mockReturnValue({ from })

    const result = await cronHandler({} as never) as { ok: boolean, results: { demoOrgSwept: number } }
    expect(result.ok).toBe(true)
    expect(result.results.demoOrgSwept).toBe(0)
    expect(deleteEq).not.toHaveBeenCalled()
  })

  it('throws 500 when the sweep query fails', async () => {
    const lt = vi.fn(async () => ({ data: null, error: { message: 'db down' } }))
    const from = vi.fn(() => ({
      select: () => ({ eq: () => ({ lt }) })
    }))
    mocks.useSupabaseAdmin.mockReturnValue({ from })

    await expect(cronHandler({} as never)).rejects.toSatisfy(error => {
      expectHttpError(error, 500, 'Cron sweep failed')
      return true
    })
  })
})
