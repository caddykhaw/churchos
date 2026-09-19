import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationPath = resolve(process.cwd(), '../../migrations/0001_init.sql')
const migration = readFileSync(migrationPath, 'utf8')

describe('Turso schema tenant-isolation contract', () => {
  it('scopes every module table to organization_id with cascade deletes', () => {
    for (const table of ['members', 'tracks', 'enrollments', 'pages']) {
      const createBlock = migration.slice(
        migration.indexOf(`CREATE TABLE IF NOT EXISTS ${table} (`),
        migration.indexOf(');', migration.indexOf(`CREATE TABLE IF NOT EXISTS ${table} (`))
      )
      expect(createBlock, `${table} must carry organization_id`).toContain('organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE')
    }
  })

  it('constrains status values at the database boundary', () => {
    expect(migration).toContain("member_status TEXT NOT NULL DEFAULT 'active' CHECK (member_status IN ('active', 'inactive', 'former', 'pending'))")
    expect(migration).toContain("status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived'))")
    expect(migration).toContain("status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'dropped'))")
    expect(migration).toContain("subscription_status TEXT NOT NULL DEFAULT 'inactive' CHECK (subscription_status IN ('inactive', 'active', 'suspended', 'cancelled'))")
  })

  it('keeps enrollment links within a single org (unique mentee+track) and pages unique per org+slug', () => {
    expect(migration).toContain('UNIQUE(track_id, mentee_id)')
    expect(migration).toContain('UNIQUE(organization_id, slug)')
  })

  it('indexes organization scoping columns for isolation-filtered queries', () => {
    for (const index of ['idx_members_org', 'idx_tracks_org', 'idx_enrollments_org', 'idx_pages_org', 'idx_org_members_org']) {
      expect(migration).toContain(index)
    }
  })
})
