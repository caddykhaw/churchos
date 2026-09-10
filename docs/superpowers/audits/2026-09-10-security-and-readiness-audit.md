# ChurchOS Audit — 2026-09-10

## Scope

Repository, build/test health, live domains, Docker stack exposure, tenant isolation, and current SaaS-readiness risks.

## Verified green

- `pnpm lint` — passed.
- `pnpm typecheck` — passed.
- `pnpm test` — **83/83 tests passed across 9 files**.
- `pnpm build` — marketing and platform Nuxt Cloudflare Pages builds passed.
- `docker compose config --quiet` — passed.
- Live smoke checks:
  - `https://churchos.my` → HTTP 200
  - `https://app.churchos.my` → HTTP 200, redirects to `/auth/login`
  - `https://demo.churchos.my` → HTTP 200
- Git was clean before build-generated ignored artifacts.
- Mutation routes currently call `requireModule(..., { role: 'admin' })`; read routes use module access without admin role.

## Critical findings

### 1. Module tables are not protected by database RLS — HIGH

Migration `supabase/migrations/20260903000002_module_tables.sql` creates:

- `members`
- `tracks`
- `enrollments`
- `pages`

but does not include `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` or module policies. The application uses the Supabase service/admin client and manually filters `organization_id`; this is a single-code-path isolation boundary, not an independent database boundary.

Unauthenticated local PostgREST reads currently return HTTP 200 for all four tables (`[]` because the local tables are empty). That confirms the endpoints are reachable without authentication. Once production data exists, exposure depends on current grants and deployment configuration.

**Recommendation:** add RLS enablement and explicit policies for every module table. Keep server-side org filtering and role checks as defense in depth. Add negative cross-org tests using authenticated users plus an anon REST read test.

### 2. PostgreSQL is internet-bound — HIGH

Live listeners and firewall state show:

- `0.0.0.0:35432` PostgreSQL
- UFW allows TCP `35432` from Anywhere

This was already noted in the 2026-09-05 audit and remains unresolved. Restrict it to localhost, a VPN, or a fixed CI source. Do not leave database access globally open for CI convenience.

### 3. Auth service is internet-bound — MEDIUM/HIGH

`0.0.0.0:38081` is listening for the local GoTrue auth service. The firewall output did not show a dedicated 38081 rule, so exposure should be confirmed at the cloud/provider firewall and Docker host level. Prefer binding internal services to `127.0.0.1` and proxying only the intended public routes.

## Important gaps

- No evidence in this audit of automated backup/restore verification for self-hosted Supabase.
- Current repository audit document from 2026-09-05 is stale on CRUD status; current tests/builds show the implementation has progressed. Refresh the SaaS readiness document after security fixes.
- Live smoke tests covered the public domains only; authenticated demo flows and negative cross-organization access were not re-run in this pass.
- Cloudflare/Stripe credential rotation items from the prior audit remain owner-action items unless separately verified.

## Recommended fix order

1. Add RLS to all module tables and explicit policies; deploy to the local stack first.
2. Add automated anon-read denial and cross-org negative tests for all module tables/endpoints.
3. Close public port `35432`; verify CI migration access through a controlled tunnel/allowlist.
4. Review/bind `38080`, `38081`, and `8088`; expose only through the intended reverse proxy.
5. Run a real demo signup → org → CRUD → logout/reset flow and record evidence.
6. Configure and test database backup restore before calling ChurchOS SaaS-ready.

## Verdict

**Build-ready, not SaaS-security-ready.** The app compiles, tests, and is live, but the database RLS gap plus publicly exposed PostgreSQL port are launch blockers. Do not onboard real church data until those two items are closed.
