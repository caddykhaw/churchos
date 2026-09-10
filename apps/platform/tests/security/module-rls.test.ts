import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationPath = resolve(
  process.cwd(),
  '../../supabase/migrations/20260910000003_module_rls_and_constraints.sql'
)
const migration = readFileSync(migrationPath, 'utf8')

describe('module RLS migration contract', () => {
  it('enables and forces RLS on every module table', () => {
    for (const table of ['members', 'tracks', 'enrollments', 'pages']) {
      expect(migration).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`)
      expect(migration).toContain(`ALTER TABLE public.${table} FORCE ROW LEVEL SECURITY`)
    }
  })

  it('defines member-read and admin-write policies for every module table', () => {
    for (const table of ['members', 'tracks', 'enrollments', 'pages']) {
      expect(migration).toContain(`CREATE POLICY ${table}_org_select`)
      expect(migration).toContain(`CREATE POLICY ${table}_admin_insert`)
      expect(migration).toContain(`CREATE POLICY ${table}_admin_update`)
      expect(migration).toContain(`CREATE POLICY ${table}_admin_delete`)
    }
    expect(migration).toContain('is_module_org_member(organization_id, auth.uid())')
    expect(migration).toContain('is_module_org_admin(organization_id, auth.uid())')
  })

  it('guards enrollment links and constrains status values', () => {
    expect(migration).toContain('validate_enrollment_organization_trigger')
    expect(migration).toContain('Enrollment references records from another organization')
    for (const constraint of [
      'members_status_check',
      'tracks_status_check',
      'enrollments_status_check',
      'organization_members_status_check',
      'organizations_subscription_status_check'
    ]) {
      expect(migration).toContain(constraint)
    }
  })
})
