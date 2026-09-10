-- ChurchOS module-table tenant isolation and data invariants.
-- RLS is the independent database boundary; server-side org filtering remains
-- required defense in depth for admin-client API handlers.

CREATE OR REPLACE FUNCTION public.is_module_org_member(
  p_organization_id UUID,
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT public.is_active_organization_member(p_organization_id, p_user_id);
$$;

CREATE OR REPLACE FUNCTION public.is_module_org_admin(
  p_organization_id UUID,
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT public.is_active_organization_admin(p_organization_id, p_user_id);
$$;

REVOKE ALL ON FUNCTION public.is_module_org_member(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_module_org_admin(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_module_org_member(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_module_org_admin(UUID, UUID) TO authenticated;

-- Valid enum-like values are enforced at the database boundary.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'members_status_check') THEN
    ALTER TABLE public.members ADD CONSTRAINT members_status_check
      CHECK (member_status IN ('active', 'inactive', 'former', 'pending'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tracks_status_check') THEN
    ALTER TABLE public.tracks ADD CONSTRAINT tracks_status_check
      CHECK (status IN ('draft', 'published', 'archived'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'enrollments_status_check') THEN
    ALTER TABLE public.enrollments ADD CONSTRAINT enrollments_status_check
      CHECK (status IN ('active', 'completed', 'dropped'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'organization_members_status_check') THEN
    ALTER TABLE public.organization_members ADD CONSTRAINT organization_members_status_check
      CHECK (status IN ('active', 'invited', 'suspended', 'removed'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'organizations_subscription_status_check') THEN
    ALTER TABLE public.organizations ADD CONSTRAINT organizations_subscription_status_check
      CHECK (subscription_status IN ('trial', 'active', 'past_due', 'suspended', 'cancelled', 'expired'));
  END IF;
END;
$$;

-- Prevent an enrollment from linking records belonging to different orgs.
CREATE OR REPLACE FUNCTION public.validate_enrollment_organization()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  track_org UUID;
  mentee_org UUID;
  mentor_org UUID;
BEGIN
  SELECT organization_id INTO track_org FROM public.tracks WHERE id = NEW.track_id;
  SELECT organization_id INTO mentee_org FROM public.members WHERE id = NEW.mentee_id;
  IF NEW.mentor_id IS NOT NULL THEN
    SELECT organization_id INTO mentor_org FROM public.members WHERE id = NEW.mentor_id;
  END IF;

  IF track_org IS NULL OR mentee_org IS NULL
     OR track_org <> NEW.organization_id
     OR mentee_org <> NEW.organization_id
     OR (NEW.mentor_id IS NOT NULL AND (mentor_org IS NULL OR mentor_org <> NEW.organization_id)) THEN
    RAISE EXCEPTION 'Enrollment references records from another organization';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_enrollment_organization_trigger ON public.enrollments;
CREATE TRIGGER validate_enrollment_organization_trigger
  BEFORE INSERT OR UPDATE ON public.enrollments
  FOR EACH ROW EXECUTE FUNCTION public.validate_enrollment_organization();

-- Enable and force policies for all module tables. FORCE also protects against
-- accidental table-owner bypasses in direct database sessions.
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members FORCE ROW LEVEL SECURITY;
ALTER TABLE public.tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracks FORCE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pages FORCE ROW LEVEL SECURITY;

CREATE POLICY members_org_select ON public.members
  FOR SELECT USING (public.is_module_org_member(organization_id, auth.uid()));
CREATE POLICY members_admin_insert ON public.members
  FOR INSERT WITH CHECK (public.is_module_org_admin(organization_id, auth.uid()));
CREATE POLICY members_admin_update ON public.members
  FOR UPDATE
  USING (public.is_module_org_admin(organization_id, auth.uid()))
  WITH CHECK (public.is_module_org_admin(organization_id, auth.uid()));
CREATE POLICY members_admin_delete ON public.members
  FOR DELETE USING (public.is_module_org_admin(organization_id, auth.uid()));

CREATE POLICY tracks_org_select ON public.tracks
  FOR SELECT USING (public.is_module_org_member(organization_id, auth.uid()));
CREATE POLICY tracks_admin_insert ON public.tracks
  FOR INSERT WITH CHECK (public.is_module_org_admin(organization_id, auth.uid()));
CREATE POLICY tracks_admin_update ON public.tracks
  FOR UPDATE
  USING (public.is_module_org_admin(organization_id, auth.uid()))
  WITH CHECK (public.is_module_org_admin(organization_id, auth.uid()));
CREATE POLICY tracks_admin_delete ON public.tracks
  FOR DELETE USING (public.is_module_org_admin(organization_id, auth.uid()));

CREATE POLICY enrollments_org_select ON public.enrollments
  FOR SELECT USING (public.is_module_org_member(organization_id, auth.uid()));
CREATE POLICY enrollments_admin_insert ON public.enrollments
  FOR INSERT WITH CHECK (public.is_module_org_admin(organization_id, auth.uid()));
CREATE POLICY enrollments_admin_update ON public.enrollments
  FOR UPDATE
  USING (public.is_module_org_admin(organization_id, auth.uid()))
  WITH CHECK (public.is_module_org_admin(organization_id, auth.uid()));
CREATE POLICY enrollments_admin_delete ON public.enrollments
  FOR DELETE USING (public.is_module_org_admin(organization_id, auth.uid()));

CREATE POLICY pages_org_select ON public.pages
  FOR SELECT USING (public.is_module_org_member(organization_id, auth.uid()));
CREATE POLICY pages_admin_insert ON public.pages
  FOR INSERT WITH CHECK (public.is_module_org_admin(organization_id, auth.uid()));
CREATE POLICY pages_admin_update ON public.pages
  FOR UPDATE
  USING (public.is_module_org_admin(organization_id, auth.uid()))
  WITH CHECK (public.is_module_org_admin(organization_id, auth.uid()));
CREATE POLICY pages_admin_delete ON public.pages
  FOR DELETE USING (public.is_module_org_admin(organization_id, auth.uid()));
