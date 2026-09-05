-- Enum integrity: CHECK constraints for all status columns.
-- The API layer validated these ad hoc; the database now enforces them too,
-- so no client (or future endpoint) can persist an unknown state.
-- Each block is safe to re-run during local verification and deployment.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'members'::regclass AND conname = 'members_member_status_check') THEN
    ALTER TABLE members
      ADD CONSTRAINT members_member_status_check
      CHECK (member_status IN ('active', 'inactive', 'former'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'tracks'::regclass AND conname = 'tracks_status_check') THEN
    ALTER TABLE tracks
      ADD CONSTRAINT tracks_status_check
      CHECK (status IN ('draft', 'published'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'enrollments'::regclass AND conname = 'enrollments_status_check') THEN
    ALTER TABLE enrollments
      ADD CONSTRAINT enrollments_status_check
      CHECK (status IN ('active', 'completed', 'dropped'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'organizations'::regclass AND conname = 'organizations_subscription_status_check') THEN
    ALTER TABLE organizations
      ADD CONSTRAINT organizations_subscription_status_check
      CHECK (subscription_status IN ('inactive', 'active', 'suspended', 'cancelled'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'organization_members'::regclass AND conname = 'organization_members_status_check') THEN
    ALTER TABLE organization_members
      ADD CONSTRAINT organization_members_status_check
      CHECK (status IN ('active', 'inactive', 'pending'));
  END IF;
END
$$;
