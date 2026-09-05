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

const patchTrackHandler = (await import('../../server/api/journey/tracks/[id].patch')).default
const deleteTrackHandler = (await import('../../server/api/journey/tracks/[id].delete')).default
const postEnrollmentHandler = (await import('../../server/api/journey/enrollments/index.post')).default
const patchEnrollmentHandler = (await import('../../server/api/journey/enrollments/[id].patch')).default

/**
 * Scripted Supabase mock: each `.from(table)` call consumes the next script
 * entry, which is a list of per-call results keyed by the first chained
 * method used on that builder. Builders are awaitable and support .single().
 */
function createScriptedAdmin(script: Record<string, Array<{ method?: string, result: unknown }>>) {
  const from = vi.fn((table: string) => {
    const calls = script[table] ?? []
    const call = calls.shift() ?? { method: 'select', result: { data: null, error: null } }
    const builder: Record<string, ReturnType<typeof vi.fn>> = {}
    for (const method of ['select', 'eq', 'order', 'range', 'or', 'neq', 'update', 'insert', 'delete', 'limit']) {
      builder[method] = vi.fn(() => builder)
    }
    builder.single = vi.fn(async () => call.result)
    Object.defineProperty(builder, 'then', {
      value: (
        onFulfilled: (value: unknown) => unknown,
        onRejected: (reason: unknown) => unknown
      ) => Promise.resolve(call.result).then(onFulfilled, onRejected),
      writable: true
    })
    builder.__firstMethod = call.method
    return builder
  })
  return { from }
}

function expectHttpError(error: unknown, statusCode: number, message: string) {
  expect(error).toMatchObject({ statusCode, message })
}

const org = { id: 'org-1', slug: 'grace-church', name: 'Grace Church' }

describe('PATCH /api/journey/tracks/:id', () => {
  beforeEach(() => {
    mocks.requireModule.mockReturnValue(org)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('updates bilingual fields and publish state', async () => {
    const updated = { id: 'track-1', title_en: 'Foundations 2', title_zh: '根基二', status: 'published' }
    const admin = createScriptedAdmin({ tracks: [{ result: { data: updated, error: null } }] })
    mocks.useSupabaseAdmin.mockReturnValue(admin)
    vi.stubGlobal('readBody', async () => ({ title_en: 'Foundations 2', title_zh: '根基二', status: 'published' }))

    await expect(patchTrackHandler({ params: { id: 'track-1' } } as never)).resolves.toEqual(updated)
    expect(admin.from).toHaveBeenCalledWith('tracks')
  })

  it('rejects a prerequisite that would create a cycle', async () => {
    const admin = createScriptedAdmin({
      tracks: [
        { result: { data: { id: 'track-a', prerequisite_track_id: 'track-1' }, error: null } }
      ]
    })
    mocks.useSupabaseAdmin.mockReturnValue(admin)
    vi.stubGlobal('readBody', async () => ({ prerequisite_track_id: 'track-a' }))

    await expect(patchTrackHandler({ params: { id: 'track-1' } } as never)).rejects.toSatisfy(error => {
      expectHttpError(error, 400, 'Prerequisite chain would create a cycle')
      return true
    })
  })

  it('rejects self-referencing prerequisite', async () => {
    const admin = createScriptedAdmin({})
    mocks.useSupabaseAdmin.mockReturnValue(admin)
    vi.stubGlobal('readBody', async () => ({ prerequisite_track_id: 'track-1' }))

    await expect(patchTrackHandler({ params: { id: 'track-1' } } as never)).rejects.toSatisfy(error => {
      expectHttpError(error, 400, 'A track cannot be its own prerequisite')
      return true
    })
  })

  it('requires the admin role', async () => {
    const admin = createScriptedAdmin({ tracks: [{ result: { data: { id: 'track-1' }, error: null } }] })
    mocks.useSupabaseAdmin.mockReturnValue(admin)
    vi.stubGlobal('readBody', async () => ({ title_en: 'New title' }))

    await patchTrackHandler({ params: { id: 'track-1' } } as never)
    expect(mocks.requireModule).toHaveBeenCalledWith(expect.anything(), 'journey', { role: 'admin' })
  })
})

describe('DELETE /api/journey/tracks/:id', () => {
  beforeEach(() => {
    mocks.requireModule.mockReturnValue(org)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('deletes a track with no enrollments', async () => {
    const admin = createScriptedAdmin({
      tracks: [
        { result: { data: { id: 'track-1' }, error: null } },
        { result: { data: null, error: null } } // prerequisite detach update
      ],
      enrollments: [{ result: { data: [], error: null } }]
    })
    mocks.useSupabaseAdmin.mockReturnValue(admin)

    await expect(deleteTrackHandler({ params: { id: 'track-1' } } as never)).resolves.toEqual({ ok: true })
  })

  it('blocks deletion while enrollments exist', async () => {
    const admin = createScriptedAdmin({
      tracks: [{ result: { data: { id: 'track-1' }, error: null } }],
      enrollments: [{ result: { data: [{ id: 'enr-1' }], error: null } }]
    })
    mocks.useSupabaseAdmin.mockReturnValue(admin)

    await expect(deleteTrackHandler({ params: { id: 'track-1' } } as never)).rejects.toSatisfy(error => {
      expectHttpError(error, 409, 'Track has enrollments and cannot be deleted. Consider archiving it as a draft instead.')
      return true
    })
  })

  it('returns 404 for another org\'s track', async () => {
    const admin = createScriptedAdmin({ tracks: [{ result: { data: null, error: null } }] })
    mocks.useSupabaseAdmin.mockReturnValue(admin)

    await expect(deleteTrackHandler({ params: { id: 'other-org' } } as never)).rejects.toSatisfy(error => {
      expectHttpError(error, 404, 'Track not found')
      return true
    })
  })
})

describe('POST /api/journey/enrollments', () => {
  beforeEach(() => {
    mocks.requireModule.mockReturnValue(org)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('enrolls a member with a mentor', async () => {
    const enrollment = { id: 'enr-1', track_id: 'track-1', mentee_id: 'member-1', mentor_id: 'member-2', status: 'active' }
    const admin = createScriptedAdmin({
      tracks: [{ result: { data: { id: 'track-1', prerequisite_track_id: null, status: 'published' }, error: null } }],
      members: [
        { result: { data: { id: 'member-1' }, error: null } },
        { result: { data: { id: 'member-2' }, error: null } }
      ],
      enrollments: [
        { result: { data: [], error: null } }, // duplicate check
        { result: { data: enrollment, error: null } } // insert
      ]
    })
    mocks.useSupabaseAdmin.mockReturnValue(admin)
    vi.stubGlobal('readBody', async () => ({ track_id: 'track-1', mentee_id: 'member-1', mentor_id: 'member-2' }))

    await expect(postEnrollmentHandler({} as never)).resolves.toEqual(enrollment)
  })

  it('blocks enrollment when the prerequisite track is not completed', async () => {
    const admin = createScriptedAdmin({
      tracks: [{ result: { data: { id: 'track-2', prerequisite_track_id: 'track-1', status: 'published' }, error: null } }],
      members: [{ result: { data: { id: 'member-1' }, error: null } }],
      enrollments: [{ result: { data: [], error: null } }]
    })
    mocks.useSupabaseAdmin.mockReturnValue(admin)
    vi.stubGlobal('readBody', async () => ({ track_id: 'track-2', mentee_id: 'member-1' }))

    await expect(postEnrollmentHandler({} as never)).rejects.toSatisfy(error => {
      expectHttpError(error, 409, 'Mentee must complete the prerequisite track first')
      return true
    })
  })

  it('blocks duplicate active enrollment in the same track', async () => {
    const admin = createScriptedAdmin({
      tracks: [{ result: { data: { id: 'track-1', prerequisite_track_id: null, status: 'published' }, error: null } }],
      members: [{ result: { data: { id: 'member-1' }, error: null } }],
      enrollments: [{ result: { data: [{ id: 'enr-existing' }], error: null } }]
    })
    mocks.useSupabaseAdmin.mockReturnValue(admin)
    vi.stubGlobal('readBody', async () => ({ track_id: 'track-1', mentee_id: 'member-1' }))

    await expect(postEnrollmentHandler({} as never)).rejects.toSatisfy(error => {
      expectHttpError(error, 409, 'Member is already enrolled in this track')
      return true
    })
  })

  it('rejects mentees from another organization', async () => {
    const admin = createScriptedAdmin({
      tracks: [{ result: { data: { id: 'track-1', prerequisite_track_id: null, status: 'published' }, error: null } }],
      members: [{ result: { data: null, error: null } }]
    })
    mocks.useSupabaseAdmin.mockReturnValue(admin)
    vi.stubGlobal('readBody', async () => ({ track_id: 'track-1', mentee_id: 'foreign-member' }))

    await expect(postEnrollmentHandler({} as never)).rejects.toSatisfy(error => {
      expectHttpError(error, 404, 'Member not found')
      return true
    })
  })
})

describe('PATCH /api/journey/enrollments/:id', () => {
  beforeEach(() => {
    mocks.requireModule.mockReturnValue(org)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('completes an enrollment and stamps completed_at', async () => {
    const updated = { id: 'enr-1', status: 'completed', completed_at: expect.any(String) }
    const admin = createScriptedAdmin({ enrollments: [{ result: { data: updated, error: null } }] })
    mocks.useSupabaseAdmin.mockReturnValue(admin)
    vi.stubGlobal('readBody', async () => ({ status: 'completed' }))

    await expect(patchEnrollmentHandler({ params: { id: 'enr-1' } } as never)).resolves.toEqual(updated)
  })

  it('rejects unknown status values before touching the database', async () => {
    const admin = createScriptedAdmin({})
    mocks.useSupabaseAdmin.mockReturnValue(admin)
    vi.stubGlobal('readBody', async () => ({ status: 'paused' }))

    await expect(patchEnrollmentHandler({ params: { id: 'enr-1' } } as never)).rejects.toSatisfy(error => {
      expectHttpError(error, 400, 'status must be one of: active, completed, dropped')
      return true
    })
  })

  it('validates a reassigned mentor belongs to the org', async () => {
    const admin = createScriptedAdmin({
      members: [{ result: { data: null, error: null } }]
    })
    mocks.useSupabaseAdmin.mockReturnValue(admin)
    vi.stubGlobal('readBody', async () => ({ mentor_id: 'foreign-mentor' }))

    await expect(patchEnrollmentHandler({ params: { id: 'enr-1' } } as never)).rejects.toSatisfy(error => {
      expectHttpError(error, 404, 'Mentor not found')
      return true
    })
  })
})
