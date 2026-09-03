-- Module tables: PEOPLE, JOURNEY, PAGES
-- All module data is scoped to an organization and accessed through
-- org-context server endpoints (admin client), mirroring the existing
-- organizations/profiles/organization_members pattern.

-- ── PEOPLE: members ─────────────────────────────────────────
CREATE TABLE members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,

  member_number TEXT,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  gender TEXT,
  marital_status TEXT,
  date_of_birth DATE,
  address TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,

  baptism_date DATE,
  membership_date DATE,
  member_status TEXT NOT NULL DEFAULT 'active',

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_members_org ON members(organization_id);
CREATE INDEX idx_members_org_name ON members(organization_id, full_name);

-- ── JOURNEY: tracks + enrollments ───────────────────────────
CREATE TABLE tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title_en TEXT NOT NULL,
  title_zh TEXT,
  description TEXT,
  prerequisite_track_id UUID REFERENCES tracks(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft', -- draft | published | archived
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_tracks_org ON tracks(organization_id);

CREATE TABLE enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  track_id UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  mentee_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  mentor_id UUID REFERENCES members(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active', -- active | completed | dropped
  enrolled_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  UNIQUE(track_id, mentee_id)
);

CREATE INDEX idx_enrollments_org ON enrollments(organization_id);
CREATE INDEX idx_enrollments_track ON enrollments(track_id);

-- ── PAGES: pages ────────────────────────────────────────────
CREATE TABLE pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  title_en TEXT NOT NULL,
  title_zh TEXT,
  title_ms TEXT,
  title_ta TEXT,
  published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, slug)
);

CREATE INDEX idx_pages_org ON pages(organization_id);

-- ── Triggers ────────────────────────────────────────────────
CREATE TRIGGER members_updated_at BEFORE UPDATE ON members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tracks_updated_at BEFORE UPDATE ON tracks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER pages_updated_at BEFORE UPDATE ON pages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();