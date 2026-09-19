import { createHmac, timingSafeEqual, randomBytes, scrypt as _scrypt } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(_scrypt) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number
) => Promise<Buffer>

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

function sessionSecret(): string {
  const config = useRuntimeConfig()
  const secret = String(config.jwtSecret || '')
  if (!secret) {
    throw createError({ statusCode: 500, message: 'JWT_SECRET is not configured' })
  }
  return secret
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url')
}

export function signSessionToken(payload: Record<string, unknown>): string {
  const body = base64url(JSON.stringify({ ...payload, exp: Date.now() + SESSION_TTL_MS }))
  const sig = createHmac('sha256', sessionSecret()).update(body).digest('base64url')
  return `${body}.${sig}`
}

export function verifySessionToken(token: string): { userId: string } | null {
  const [body, sig] = token.split('.')
  if (!body || !sig) return null
  const expected = createHmac('sha256', sessionSecret()).update(body).digest()
  let provided: Buffer
  try {
    provided = Buffer.from(sig, 'base64url')
  } catch {
    return null
  }
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return null
  }
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as { exp?: number, userId?: string }
    if (!payload.userId || typeof payload.exp !== 'number' || payload.exp < Date.now()) return null
    return { userId: payload.userId }
  } catch {
    return null
  }
}

/** Hashes a password for storage (scrypt, per-user random salt). */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex')
  const derived = await scrypt(password, salt, 64)
  return `scrypt:${salt}:${derived.toString('hex')}`
}

/** Constant-time password verification against a stored hash. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, salt, hash] = stored.split(':')
  if (scheme !== 'scrypt' || !salt || !hash) return false
  const derived = await scrypt(password, salt, 64)
  const expected = Buffer.from(hash, 'hex')
  if (derived.length !== expected.length) return false
  return timingSafeEqual(derived, expected)
}
