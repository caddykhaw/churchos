/**
 * Minimal in-memory sliding-window rate limiter for public endpoints.
 * Sufficient for a single-instance Nitro deployment; swap for a shared store
 * (e.g. Cloudflare KV / Upstash) if the app ever runs multi-instance.
 */

type Bucket = { hits: number[] }

const buckets = new Map<string, Bucket>()

/** Periodically drop empty/expired buckets so the map cannot grow unbounded. */
let lastSweep = Date.now()
function sweep(now: number, windowMs: number) {
  if (now - lastSweep < windowMs) return
  lastSweep = now
  for (const [key, bucket] of buckets) {
    bucket.hits = bucket.hits.filter(t => now - t < windowMs)
    if (bucket.hits.length === 0) buckets.delete(key)
  }
}

export type RateLimitResult = {
  allowed: boolean
  remaining: number
  retryAfterSeconds: number
}

/**
 * Records a hit for `key` and returns whether it is within `max` requests
 * per `windowMs`.
 */
export function rateLimit(key: string, max: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  sweep(now, windowMs)

  const bucket = buckets.get(key) ?? { hits: [] }
  bucket.hits = bucket.hits.filter(t => now - t < windowMs)

  if (bucket.hits.length >= max) {
    const oldest = bucket.hits[0]
    buckets.set(key, bucket)
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: oldest === undefined ? 1 : Math.max(1, Math.ceil((oldest + windowMs - now) / 1000))
    }
  }

  bucket.hits.push(now)
  buckets.set(key, bucket)
  return {
    allowed: true,
    remaining: max - bucket.hits.length,
    retryAfterSeconds: 0
  }
}

/** Best-effort client identity for rate limiting (IP with fallbacks). */
export function clientKey(event: { node?: { req?: { socket?: { remoteAddress?: string } } } }, scope: string): string {
  const ip = event.node?.req?.socket?.remoteAddress || 'unknown'
  return `${scope}:${ip}`
}
