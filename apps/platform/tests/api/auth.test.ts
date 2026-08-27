import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  useSupabaseAdmin: vi.fn(),
  createClient: vi.fn()
}))

vi.mock('../../server/utils/supabase', () => ({ useSupabaseAdmin: mocks.useSupabaseAdmin }))
vi.mock('@supabase/supabase-js', () => ({ createClient: mocks.createClient }))

vi.stubGlobal('defineEventHandler', <T>(callback: T) => callback)
const signup = (await import('../../server/api/auth/signup.post')).default
const login = (await import('../../server/api/auth/login.post')).default
const logout = (await import('../../server/api/auth/logout.post')).default
const me = (await import('../../server/api/auth/me.get')).default

function expectHttpError(error: unknown, statusCode: number, message: string) {
  expect(error).toMatchObject({ statusCode, message })
}

function createAdmin({
  user = { id: 'user-1', email: 'member@example.com' },
  authError = null,
  profileError = null
}: {
  user?: { id: string, email: string } | null
  authError?: unknown
  profileError?: unknown
} = {}) {
  const createUser = vi.fn(async () => ({ data: { user }, error: authError }))
  const profileInsert = vi.fn(async () => ({ error: profileError }))

  return {
    auth: { admin: { createUser } },
    from: vi.fn(() => ({ insert: profileInsert })),
    createUser,
    profileInsert
  }
}

function createSignInClient({
  session = { access_token: 'access-token' },
  error = null
}: {
  session?: { access_token: string } | null
  error?: unknown
} = {}) {
  const signInWithPassword = vi.fn(async () => ({ data: { session }, error }))
  return { auth: { signInWithPassword }, signInWithPassword }
}

describe('auth API endpoints', () => {
  beforeEach(() => {
    vi.stubGlobal('defineEventHandler', <T>(callback: T) => callback)
    vi.stubGlobal('createError', ({ statusCode, message }: { statusCode: number, message: string }) => {
      const error = new Error(message) as Error & { statusCode: number }
      error.statusCode = statusCode
      return error
    })
    vi.stubGlobal('useRuntimeConfig', () => ({
      public: { supabaseUrl: 'http://supabase.test', supabaseAnonKey: 'anon-key' }
    }))
    vi.stubGlobal('setCookie', vi.fn())
    vi.stubGlobal('deleteCookie', vi.fn())
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  it('rejects signup requests without a valid password before calling Supabase', async () => {
    vi.stubGlobal('readBody', async () => ({ email: 'member@example.com', password: 'short' }))

    await expect(signup({} as never)).rejects.toSatisfy(error => {
      expectHttpError(error, 400, 'Password must be at least 8 characters')
      return true
    })
    expect(mocks.useSupabaseAdmin).not.toHaveBeenCalled()
  })

  it('creates a profile, signs in, and sets a protected session cookie on signup', async () => {
    const admin = createAdmin()
    const client = createSignInClient()
    mocks.useSupabaseAdmin.mockReturnValue(admin)
    mocks.createClient.mockReturnValue(client)
    vi.stubGlobal('readBody', async () => ({
      email: 'member@example.com', password: 'strong-password', displayName: 'Member'
    }))

    await expect(signup({} as never)).resolves.toEqual({ user: { id: 'user-1', email: 'member@example.com' } })
    expect(admin.createUser).toHaveBeenCalledWith({
      email: 'member@example.com',
      password: 'strong-password',
      email_confirm: true,
      user_metadata: { display_name: 'Member' }
    })
    expect(admin.profileInsert).toHaveBeenCalledWith({
      id: 'user-1', email: 'member@example.com', display_name: 'Member', preferred_language: 'en'
    })
    expect(client.signInWithPassword).toHaveBeenCalledWith({ email: 'member@example.com', password: 'strong-password' })
    expect(globalThis.setCookie).toHaveBeenCalledWith(expect.anything(), '__session', 'access-token', expect.objectContaining({
      httpOnly: true, sameSite: 'lax', maxAge: 604800, path: '/'
    }))
  })

  it('does not create a session when login credentials are invalid', async () => {
    const client = createSignInClient({ session: null, error: { message: 'Invalid login credentials' } })
    mocks.createClient.mockReturnValue(client)
    vi.stubGlobal('readBody', async () => ({ email: 'member@example.com', password: 'wrong-password' }))

    await expect(login({} as never)).rejects.toSatisfy(error => {
      expectHttpError(error, 401, 'Invalid credentials')
      return true
    })
    expect(globalThis.setCookie).not.toHaveBeenCalled()
  })

  it('deletes the session cookie on logout', () => {
    expect(logout({} as never)).toEqual({ success: true })
    expect(globalThis.deleteCookie).toHaveBeenCalledWith(expect.anything(), '__session', { path: '/' })
  })

  it('returns the current user and organization context from the middleware', async () => {
    const event = {
      context: {
        user: {
          id: 'user-1', email: 'member@example.com', profile: { id: 'user-1' },
          organizations: [{ roles: ['admin'], organizations: { id: 'org-1', slug: 'grace', name: 'Grace Church', subscription_status: 'trial' } }]
        },
        org: { id: 'org-1', slug: 'grace' }
      }
    }

    expect(me(event as never)).toEqual({
      authenticated: true,
      user: { id: 'user-1', email: 'member@example.com', profile: { id: 'user-1' } },
      organizations: [{ id: 'org-1', slug: 'grace', name: 'Grace Church', subscription_status: 'trial', roles: ['admin'] }],
      currentOrg: { id: 'org-1', slug: 'grace' }
    })
  })
})
