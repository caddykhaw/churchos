import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDbMock } from '../helpers/db-mock'

const mocks = vi.hoisted(() => ({
  clerkCreateUser: vi.fn(),
  verifyPassword: vi.fn(),
  signSessionToken: vi.fn()
}))

vi.mock('@clerk/nuxt/server', () => ({
  clerkClient: () => ({ users: { createUser: mocks.clerkCreateUser } })
}))

vi.mock('../../server/utils/session', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../server/utils/session')>()
  return {
    ...actual,
    verifyPassword: mocks.verifyPassword,
    signSessionToken: mocks.signSessionToken
  }
})

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

const login = (await import('../../server/api/auth/login.post')).default
const logout = (await import('../../server/api/auth/logout.post')).default
const me = (await import('../../server/api/auth/me.get')).default

function expectHttpError(error: unknown, statusCode: number, message: string) {
  expect(error).toMatchObject({ statusCode, message })
}

describe('auth API endpoints', () => {
  beforeEach(() => {
    db = createDbMock()
    mocks.signSessionToken.mockReturnValue('signed-token')
    vi.stubGlobal('useRuntimeConfig', () => ({
      public: { demoEmail: 'demo@churchos.my' },
      jwtSecret: 'test-secret'
    }))
    vi.stubGlobal('getRequestHeader', (_event: unknown, name: string) => name === 'origin' ? 'https://app.churchos.test' : undefined)
    vi.stubGlobal('getRequestURL', () => new URL('https://app.churchos.test/api/auth/set-session'))
    vi.stubGlobal('setCookie', vi.fn())
    vi.stubGlobal('deleteCookie', vi.fn())
    vi.stubGlobal('clientKey', () => 'test-key')
    vi.stubGlobal('rateLimit', () => ({ allowed: true, remaining: 1, retryAfterSeconds: 0 }))
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  it('rejects login when credentials do not verify', async () => {
    db.dbOne
      .mockResolvedValueOnce({ id: 'user-1' }) // profiles lookup
      .mockResolvedValueOnce({ password_hash: 'scrypt:salt:hash' }) // credential lookup
    mocks.verifyPassword.mockResolvedValue(false)
    vi.stubGlobal('readBody', async () => ({ email: 'member@example.com', password: 'wrong-password' }))

    await expect(login({} as never)).rejects.toSatisfy(error => {
      expectHttpError(error, 401, 'Invalid credentials')
      return true
    })
    expect(globalThis.setCookie).not.toHaveBeenCalled()
  })

  it('sets a signed session cookie on successful login', async () => {
    db.dbOne
      .mockResolvedValueOnce({ id: 'user-1' })
      .mockResolvedValueOnce({ password_hash: 'scrypt:salt:hash' })
    mocks.verifyPassword.mockResolvedValue(true)
    vi.stubGlobal('readBody', async () => ({ email: 'member@example.com', password: 'correct-password' }))

    await expect(login({} as never)).resolves.toEqual({ success: true })
    expect(globalThis.setCookie).toHaveBeenCalledWith(expect.anything(), '__session', 'signed-token', expect.objectContaining({
      httpOnly: true, sameSite: 'lax', maxAge: 604800, path: '/'
    }))
  })

  it('deletes the session cookie on logout', async () => {
    await expect(logout({ context: {} } as never)).resolves.toEqual({ success: true })
    expect(globalThis.deleteCookie).toHaveBeenCalledWith(expect.anything(), '__session', { path: '/' })
    expect(globalThis.deleteCookie).toHaveBeenCalledWith(expect.anything(), '__org_id', { path: '/' })
  })

  it('deletes the demo org on logout from a demo sandbox', async () => {
    await expect(logout({ context: { org: { id: 'org-demo', is_demo: true } } } as never)).resolves.toEqual({ success: true })
    expect(db.dbRun).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM organizations'), ['org-demo'])
  })

  it('returns the current user and organization context from the middleware', async () => {
    const event = {
      context: {
        user: {
          id: 'user-1', email: 'member@example.com', profile: { id: 'user-1' },
          organizations: [{ roles: ['admin'], status: 'active', organization_id: 'org-1', organizations: { id: 'org-1', slug: 'grace', name: 'Grace Church', subscription_status: 'inactive', is_demo: false } }]
        },
        org: { id: 'org-1', slug: 'grace' }
      }
    }

    expect(me(event as never)).toEqual({
      authenticated: true,
      user: { id: 'user-1', email: 'member@example.com', profile: { id: 'user-1' } },
      organizations: [{ id: 'org-1', slug: 'grace', name: 'Grace Church', subscription_status: 'inactive', is_demo: false, roles: ['admin'] }],
      currentOrg: { id: 'org-1', slug: 'grace' }
    })
  })
})
