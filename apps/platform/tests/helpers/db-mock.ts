import { vi } from 'vitest'

/**
 * Mock for server/utils/db. Handlers call dbAll/dbOne/dbRun with SQL strings;
 * tests script responses per table by inspecting the SQL.
 */
export function createDbMock() {
  const state = {
    /** Rows returned for SELECT-style queries, keyed by table name in the SQL. */
    rows: new Map<string, Record<string, unknown>[]>()
  }

  const dbAll = vi.fn(async (sql: string) => {
    const table = tableOf(sql)
    return state.rows.get(table) ?? []
  })

  const dbOne = vi.fn(async (sql: string) => {
    const table = tableOf(sql)
    const rows = state.rows.get(table) ?? []
    return rows[0] ?? null
  })

  const dbRun = vi.fn(async () => 1)

  function tableOf(sql: string): string {
    const match = sql.match(/\b(?:FROM|INTO|UPDATE)\s+([a-z_]+)/i)
    return match ? match[1]! : '*'
  }

  return { dbAll, dbOne, dbRun, state }
}
