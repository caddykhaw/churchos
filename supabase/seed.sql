-- Demo organizations (no-trial model)
-- Demo sandbox orgs are is_demo = true and are provisioned on demand per
-- session by the app; the row below is a static example for local UI work.
-- Self-registered workspaces start 'inactive' until the owner activates them.
INSERT INTO organizations (id, slug, name, subscription_tier, billing_cycle, subscribed_modules, trial_ends_at, subscription_status, is_demo) VALUES
  ('11111111-1111-1111-1111-111111111111', 'demo-church', 'Demo Church KL', 'growth', 'annual', ARRAY['people', 'journey', 'pages'], NULL, 'active', true),
  ('22222222-2222-2222-2222-222222222222', 'grace-baptist', 'Grace Baptist Church', 'starter', 'monthly', ARRAY['journey'], NULL, 'active', false),
  ('33333333-3333-3333-3333-333333333333', 'new-hope', 'New Hope Assembly', 'starter', 'monthly', '{}', NULL, 'inactive', false);

-- Note: In production, you'll need to create real auth.users first via Supabase Auth API
-- These are placeholder organization records for testing UI flows
