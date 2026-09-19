import { createTursoClient, type LibsqlClient } from '@churchos/database'

let _client: LibsqlClient | null = null

/** Shared Turso client (runtime config: tursoUrl + tursoAuthToken). */
export function useDb(): LibsqlClient {
  if (!_client) {
    const config = useRuntimeConfig()
    const url = String(config.tursoUrl || '')
    if (!url) {
      throw createError({ statusCode: 500, message: 'TURSO_DATABASE_URL is not configured' })
    }
    _client = createTursoClient(url, config.tursoAuthToken ? String(config.tursoAuthToken) : undefined)
  }
  return _client
}

/** Shorthand for a parameterized query returning rows. */
export async function dbAll(sql: string, args: unknown[] = []): Promise<Record<string, unknown>[]> {
  const result = await useDb().execute({ sql, args: args as never[] })
  return result.rows as unknown as Record<string, unknown>[]
}

/** Shorthand for a parameterized query expected to return one row or null. */
export async function dbOne(sql: string, args: unknown[] = []): Promise<Record<string, unknown> | null> {
  const rows = await dbAll(sql, args)
  return rows[0] ?? null
}

/** Shorthand for INSERT/UPDATE/DELETE; returns affected row count. */
export async function dbRun(sql: string, args: unknown[] = []): Promise<number> {
  const result = await useDb().execute({ sql, args: args as never[] })
  return result.rowsAffected
}
