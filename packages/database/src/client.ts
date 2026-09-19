import { createClient } from '@libsql/client'

export type LibsqlClient = ReturnType<typeof createClient>

/**
 * Creates a Turso/libSQL client.
 * - Remote: url like libsql://<db>-<org>.turso.io + authToken (Workers-safe, fetch-based).
 * - Local:  url like file:./local.db (used by tests / local dev).
 */
export function createTursoClient(url: string, authToken?: string): LibsqlClient {
  return createClient({ url, authToken })
}
