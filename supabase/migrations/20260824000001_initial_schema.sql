-- Organizations table
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  custom_domain TEXT UNIQUE,
  custom_domain_verified BOOLEAN DEFAULT false,

  subscription_tier TEXT NOT NULL DEFAULT 'starter',
  billing_cycle TEXT NOT NULL DEFAULT 'monthly',
  subscribed_modules TEXT[] NOT NULL DEFAULT '{}',
  trial_ends_at TIMESTAMPTZ,
  subscription_status TEXT NOT NULL DEFAULT 'trial',
  suspended_at TIMESTAMPTZ,
  suspension_months INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_organizations_custom_domain ON organizations(custom_domain) WHERE custom_domain IS NOT NULL;

-- Profiles table (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  preferred_language TEXT DEFAULT 'en',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Organization membership (many-to-many)
CREATE TABLE organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  roles TEXT[] NOT NULL DEFAULT '{member}',
  status TEXT NOT NULL DEFAULT 'active',

  joined_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(organization_id, user_id)
);

CREATE INDEX idx_org_members_org ON organization_members(organization_id);
CREATE INDEX idx_org_members_user ON organization_members(user_id);

-- Helper function: get current org from JWT
CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS UUID AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::json->>'organization_id',
    current_setting('app.current_org_id', true)
  )::UUID;
$$ LANGUAGE SQL STABLE;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER organizations_updated_at BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
