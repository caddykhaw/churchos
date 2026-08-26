-- Strict tenant-isolation RLS for the core multi-tenant tables.
-- Membership checks are SECURITY DEFINER helpers so policies never query an
-- RLS-protected table recursively, and never trust an unverified org claim.

CREATE OR REPLACE FUNCTION public.is_active_organization_member(
  p_organization_id UUID,
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members AS om
    WHERE om.organization_id = p_organization_id
      AND om.user_id = p_user_id
      AND om.status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_active_organization_admin(
  p_organization_id UUID,
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members AS om
    WHERE om.organization_id = p_organization_id
      AND om.user_id = p_user_id
      AND om.status = 'active'
      AND 'admin' = ANY (om.roles)
  );
$$;

REVOKE ALL ON FUNCTION public.is_active_organization_member(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_active_organization_admin(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_active_organization_member(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_organization_admin(UUID, UUID) TO authenticated;

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.organizations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members FORCE ROW LEVEL SECURITY;

-- Users can only see organizations in which they are verified active members.
CREATE POLICY organizations_select_policy ON public.organizations
  FOR SELECT
  USING (public.is_active_organization_member(id, auth.uid()));

-- Users can only see or modify their own profile.
CREATE POLICY profiles_select_policy ON public.profiles
  FOR SELECT
  USING (id = auth.uid());

CREATE POLICY profiles_update_policy ON public.profiles
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- A membership row is visible only after active membership in that row's org
-- has been verified independently of any JWT org-context claim.
CREATE POLICY org_members_select_policy ON public.organization_members
  FOR SELECT
  USING (public.is_active_organization_member(organization_id, auth.uid()));

-- Only verified active admins can manage memberships. UPDATE validates both
-- the existing row (USING) and the replacement row (WITH CHECK), preventing
-- cross-organization moves or privilege changes outside an admin's org.
CREATE POLICY org_members_admin_insert ON public.organization_members
  FOR INSERT
  WITH CHECK (public.is_active_organization_admin(organization_id, auth.uid()));

CREATE POLICY org_members_admin_update ON public.organization_members
  FOR UPDATE
  USING (public.is_active_organization_admin(organization_id, auth.uid()))
  WITH CHECK (public.is_active_organization_admin(organization_id, auth.uid()));
