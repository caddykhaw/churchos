import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const rl = (await import('../../server/utils/rate-limit')) as typeof import('../../server/utils/rate-limit')

describe('rateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('allows requests under the limit and blocks beyond it', () => {
    const key = 'test-under:' + Math.random()
    expect(rl.rateLimit(key, 3, 60_000).allowed).toBe(true)
    expect(rl.rateLimit(key, 3, 60_000).allowed).toBe(true)
    expect(rl.rateLimit(key, 3, 60_000).allowed).toBe(true)
    const blocked = rl.rateLimit(key, 3, 60_000)
    expect(blocked.allowed).toBe(false)
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0)
  })

  it('resets after the window elapses', () => {
    const key = 'test-window:' + Math.random()
    expect(rl.rateLimit(key, 1, 60_000).allowed).toBe(true)
    expect(rl.rateLimit(key, 1, 60_000).allowed).toBe(false)
    vi.advanceTimersByTime(61_000)
    expect(rl.rateLimit(key, 1, 60_000).allowed).toBe(true)
  })

  it('tracks remaining hits', () => {
    const key = 'test-remaining:' + Math.random()
    expect(rl.rateLimit(key, 2, 60_000).remaining).toBe(1)
    expect(rl.rateLimit(key, 2, 60_000).remaining).toBe(0)
  })

  it('isolates keys independently', () => {
    const a = 'test-iso-a:' + Math.random()
    const b = 'test-iso-b:' + Math.random()
    expect(rl.rateLimit(a, 1, 60_000).allowed).toBe(true)
    expect(rl.rateLimit(a, 1, 60_000).allowed).toBe(false)
    expect(rl.rateLimit(b, 1, 60_000).allowed).toBe(true)
  })
})
