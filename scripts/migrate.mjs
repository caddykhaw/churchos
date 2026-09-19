#!/usr/bin/env node
/**
 * Applies SQL migrations in migrations/ to the Turso database.
 * Usage: node scripts/migrate.mjs   (requires TURSO_DATABASE_URL + TURSO_AUTH_TOKEN)
 * Skips files already recorded in schema_migrations.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

// Resolve @libsql/client from the platform app's node_modules (pnpm layout);
// the script lives outside the workspace globs so bare imports don't resolve.
const require = createRequire(import.meta.url)
const { createClient } = require('../apps/platform/node_modules/@libsql/client/lib-cjs/node.js')

const url = process.env.TURSO_DATABASE_URL
const authToken = process.env.TURSO_AUTH_TOKEN

if (!url) {
  console.error('TURSO_DATABASE_URL is required (e.g. libsql://churchos-<org>.turso.io)')
  process.exit(1)
}

const client = createClient({ url, authToken })

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations')
const files = readdirSync(dir)
  .filter((f) => f.endsWith('.sql'))
  .sort()

await client.execute(`CREATE TABLE IF NOT EXISTS schema_migrations (
  filename TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
)`)

const applied = new Set()
const result = await client.execute('SELECT filename FROM schema_migrations')
for (const row of result.rows) applied.add(String(row.filename))

let ran = 0
for (const file of files) {
  if (applied.has(file)) {
    console.log(`Skipping ${file} (already applied)`)
    continue
  }
  const sql = readFileSync(join(dir, file), 'utf8')
  console.log(`Applying ${file}`)
  // libSQL executes multiple statements separated by semicolons.
  await client.executeMultiple(sql)
  await client.execute({ sql: 'INSERT INTO schema_migrations (filename) VALUES (?)', args: [file] })
  ran++
}

console.log(ran === 0 ? 'Database up to date.' : `Applied ${ran} migration(s).`)
client.close()
