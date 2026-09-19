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

function expectHttpError(error: unknown, statusCode: number, message: string) {
  expect(error).toMatchObject({ statusCode, message })
}

const org = { id: 'org-1', slug: 'grace-church', name: 'Grace Church' }

describe('PATCH /api/journey/tracks/:id', () => {
  beforeEach(() => {
    mocks.requireModule.mockReturnValue(org)
    db = createDbMock()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('updates bilingual fields and publish state', async () => {
    const updated = { id: 'track-1', title_en: 'Foundations 2', title_zh: '根基二', status: 'published' }
    db.dbRun.mockResolvedValue(1)
    db.dbOne.mockResolvedValue(updated)
    vi.stubGlobal('readBody', async () => ({ title_en: 'Foundations 2', title_zh: '根基二', status: 'published' }))

    await expect(patchTrackHandler({ params: { id: 'track-1' } } as never)).resolves.toEqual(updated)
    const [sql, args] = db.dbRun.mock.calls[0]!
    expect(String(sql)).toContain('title_en = ?')
    expect(String(sql)).toContain('organization_id = ?')
    expect(args).toContain('根基二')
  })

  it('rejects a prerequisite that would create a cycle', async () => {
    db.dbOne.mockResolvedValue({ id: 'track-a', prerequisite_track_id: 'track-1' })
    vi.stubGlobal('readBody', async () => ({ prerequisite_track_id: 'track-a' }))

    await expect(patchTrackHandler({ params: { id: 'track-1' } } as never)).rejects.toSatisfy(error => {
      expectHttpError(error, 400, 'Prerequisite chain would create a cycle')
      return true
    })
  })

  it('rejects self-referencing prerequisite', async () => {
    vi.stubGlobal('readBody', async () => ({ prerequisite_track_id: 'track-1' }))

    await expect(patchTrackHandler({ params: { id: 'track-1' } } as never)).rejects.toSatisfy(error => {
      expectHttpError(error, 400, 'A track cannot be its own prerequisite')
      return true
    })
  })

  it('requires the admin role', async () => {
    db.dbRun.mockResolvedValue(1)
    db.dbOne.mockResolvedValue({ id: 'track-1' })
    vi.stubGlobal('readBody', async () => ({ title_en: 'New title' }))

    await patchTrackHandler({ params: { id: 'track-1' } } as never)
    expect(mocks.requireModule).toHaveBeenCalledWith(expect.anything(), 'journey', { role: 'admin' })
  })
})

describe('DELETE /api/journey/tracks/:id', () => {
  beforeEach(() => {
    mocks.requireModule.mockReturnValue(org)
    db = createDbMock()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('deletes a track with no enrollments', async () => {
    db.dbOne
      .mockResolvedValueOnce({ id: 'track-1' }) // track lookup
      .mockResolvedValueOnce(null) // enrollment check
    db.dbRun.mockResolvedValue(1)

    await expect(deleteTrackHandler({ params: { id: 'track-1' } } as never)).resolves.toEqual({ ok: true })
    expect(db.dbRun).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM tracks'), ['track-1', 'org-1'])
  })

  it('blocks deletion while enrollments exist', async () => {
    db.dbOne
      .mockResolvedValueOnce({ id: 'track-1' })
      .mockResolvedValueOnce({ id: 'enr-1' })

    await expect(deleteTrackHandler({ params: { id: 'track-1' } } as never)).rejects.toSatisfy(error => {
      expectHttpError(error, 409, 'Track has enrollments and cannot be deleted. Consider archiving it as a draft instead.')
      return true
    })
  })

  it('returns 404 for another org\'s track', async () => {
    db.dbOne.mockResolvedValue(null)

    await expect(deleteTrackHandler({ params: { id: 'other-org' } } as never)).rejects.toSatisfy(error => {
      expectHttpError(error, 404, 'Track not found')
      return true
    })
  })
})

describe('POST /api/journey/enrollments', () => {
  beforeEach(() => {
    mocks.requireModule.mockReturnValue(org)
    db = createDbMock()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('enrolls a member with a mentor', async () => {
    const enrollment = { id: 'enr-1', track_id: 'track-1', mentee_id: 'member-1', mentor_id: 'member-2', status: 'active' }
    db.dbOne
      .mockResolvedValueOnce({ id: 'track-1', prerequisite_track_id: null, status: 'published' }) // track
      .mockResolvedValueOnce({ id: 'member-1' }) // mentee
      .mockResolvedValueOnce({ id: 'member-2' }) // mentor
      .mockResolvedValueOnce(null) // duplicate active check
      .mockResolvedValueOnce(enrollment) // final fetch
    vi.stubGlobal('readBody', async () => ({ track_id: 'track-1', mentee_id: 'member-1', mentor_id: 'member-2' }))

    await expect(postEnrollmentHandler({} as never)).resolves.toEqual(enrollment)
    expect(db.dbRun).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO enrollments'), expect.anything())
  })

  it('blocks enrollment when the prerequisite track is not completed', async () => {
    db.dbOne
      .mockResolvedValueOnce({ id: 'track-2', prerequisite_track_id: 'track-1', status: 'published' })
      .mockResolvedValueOnce({ id: 'member-1' })
      .mockResolvedValueOnce(null) // no completed prerequisite enrollment
    vi.stubGlobal('readBody', async () => ({ track_id: 'track-2', mentee_id: 'member-1' }))

    await expect(postEnrollmentHandler({} as never)).rejects.toSatisfy(error => {
      expectHttpError(error, 409, 'Mentee must complete the prerequisite track first')
      return true
    })
  })

  it('blocks duplicate active enrollment in the same track', async () => {
    db.dbOne
      .mockResolvedValueOnce({ id: 'track-1', prerequisite_track_id: null, status: 'published' })
      .mockResolvedValueOnce({ id: 'member-1' })
      .mockResolvedValueOnce({ id: 'enr-existing' }) // duplicate active
    vi.stubGlobal('readBody', async () => ({ track_id: 'track-1', mentee_id: 'member-1' }))

    await expect(postEnrollmentHandler({} as never)).rejects.toSatisfy(error => {
      expectHttpError(error, 409, 'Member is already enrolled in this track')
      return true
    })
  })

  it('rejects mentees from another organization', async () => {
    db.dbOne
      .mockResolvedValueOnce({ id: 'track-1', prerequisite_track_id: null, status: 'published' })
      .mockResolvedValueOnce(null) // mentee not in org
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
    db = createDbMock()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('completes an enrollment and stamps completed_at', async () => {
    const updated = { id: 'enr-1', status: 'completed', completed_at: expect.any(String) }
    db.dbRun.mockResolvedValue(1)
    db.dbOne.mockResolvedValue(updated)
    vi.stubGlobal('readBody', async () => ({ status: 'completed' }))

    await expect(patchEnrollmentHandler({ params: { id: 'enr-1' } } as never)).resolves.toEqual(updated)
    const [sql, args] = db.dbRun.mock.calls[0]!
    expect(String(sql)).toContain('status = ?')
    expect(String(sql)).toContain('completed_at = ?')
    expect(args).toContain('completed')
  })

  it('rejects unknown status values before touching the database', async () => {
    vi.stubGlobal('readBody', async () => ({ status: 'paused' }))

    await expect(patchEnrollmentHandler({ params: { id: 'enr-1' } } as never)).rejects.toSatisfy(error => {
      expectHttpError(error, 400, 'status must be one of: active, completed, dropped')
      return true
    })
    expect(db.dbRun).not.toHaveBeenCalled()
  })

  it('validates a reassigned mentor belongs to the org', async () => {
    db.dbOne.mockResolvedValue(null)
    vi.stubGlobal('readBody', async () => ({ mentor_id: 'foreign-mentor' }))

    await expect(patchEnrollmentHandler({ params: { id: 'enr-1' } } as never)).rejects.toSatisfy(error => {
      expectHttpError(error, 404, 'Mentor not found')
      return true
    })
  })
})
