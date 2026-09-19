export type { LibsqlClient } from './client'
export { createTursoClient } from './client'
export * from './types'

/** Rows are returned as plain objects; booleans are stored as 0/1. */
export type DbRow = Record<string, unknown>

export function nowIso(): string {
  return new Date().toISOString()
}

export function generateId(): string {
  return crypto.randomUUID()
}

/** Safe parse for JSON-encoded array columns (subscribed_modules, roles). */
export function parseJsonArray(value: unknown): string[] {
  if (typeof value !== 'string') return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}
