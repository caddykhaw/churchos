-- Demo sandbox + no-trial model
-- 1. Workspaces created by self-registration start 'inactive' until the
--    owner activates them (no more free-trial clock).
-- 2. Demo sandbox orgs are flagged is_demo = true so sessions can be
--    provisioned on demand and wiped on logout.

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE organizations
  ALTER COLUMN subscription_status SET DEFAULT 'inactive';

-- Any legacy trial rows become inactive (no expiry semantics remain).
UPDATE organizations
  SET subscription_status = 'inactive', trial_ends_at = NULL
  WHERE subscription_status = 'trial';

CREATE INDEX idx_organizations_is_demo ON organizations(is_demo)
  WHERE is_demo = true;