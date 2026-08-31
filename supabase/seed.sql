-- Demo organizations
INSERT INTO organizations (id, slug, name, subscription_tier, billing_cycle, subscribed_modules, trial_ends_at, subscription_status) VALUES
  ('11111111-1111-1111-1111-111111111111', 'demo-church', 'Demo Church KL', 'growth', 'annual', ARRAY['people', 'journey', 'pages'], NULL, 'active'),
  ('22222222-2222-2222-2222-222222222222', 'grace-baptist', 'Grace Baptist Church', 'starter', 'monthly', ARRAY['journey'], NULL, 'active'),
  ('33333333-3333-3333-3333-333333333333', 'trial-org', 'Trial Organization', 'starter', 'monthly', '{}', NOW() + INTERVAL '14 days', 'trial');

-- Note: In production, you'll need to create real auth.users first via Supabase Auth API
-- These are placeholder organization records for testing UI flows
