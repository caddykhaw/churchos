# ChurchOS SaaS Readiness Implementation Plan

> **For Hermes:** Execute this plan directly on `/root/projects/churchos`, one task at a time. Keep the todo list synchronized and commit at every phase boundary.

**Goal:** Move ChurchOS from a working demo-first MVP to a production-safe, multi-tenant SaaS platform suitable for real church data.

**Current baseline:** Lint, typecheck, 83 tests, builds, Docker Compose validation, and public smoke tests pass. Current blockers are missing module-table RLS, internet-exposed PostgreSQL, incomplete operational controls, and missing launch-path verification.

**Architecture:** Keep Nuxt/Nitro on Cloudflare Pages, self-hosted Supabase/Postgres behind controlled access, and server-side organization context plus role checks. RLS becomes the independent database boundary; application filters remain defense in depth. Do not reintroduce Stripe until the security and tenant model are production-safe.

**Tech stack:** Nuxt 4, Vue 3, Nitro, TypeScript, pnpm, self-hosted Supabase/Postgres, Docker Compose, Cloudflare Pages, Vitest.

---

## Phase 1 — Database security boundary (P0)

### Task 1.1 — Enable RLS on all module tables

**Files:**
- Modify: `supabase/migrations/<new_timestamp>_module_rls.sql`
- Reference: `supabase/migrations/20260903000002_module_tables.sql`

**Work:** Enable RLS on `members`, `tracks`, `enrollments`, and `pages`. Add indexes needed by policy predicates. Ensure service-role/admin operations remain functional.

**Acceptance:** `pg_class.relrowsecurity` is true for all four tables; local migration applies cleanly.

### Task 1.2 — Add member-read and admin-write policies

**Files:**
- Modify: new module RLS migration
- Reference: `supabase/migrations/20260824000002_rls_policies.sql`

**Work:** Policies must derive organization membership from authenticated identity, never from a client-supplied organization claim. Members can read only rows in active organizations they belong to. Admins can insert/update/delete within their organization.

**Acceptance:** Authenticated user in org A cannot read or mutate org B members; admin in org A can CRUD org A members.

### Task 1.3 — Add relational integrity policies for Journey and Pages

**Work:** Add RLS for `tracks`, `enrollments`, and `pages`. Ensure enrollment rows cannot cross-link a track/member from different organizations. Ensure page reads/writes are organization-scoped.

**Acceptance:** Cross-org joins and mutations fail or return no rows; same-org admin operations pass.

### Task 1.4 — Add database enum/check constraints

**Work:** Add CHECK constraints for `member_status`, `tracks.status`, `enrollments.status`, subscription state, and membership state. Update API validation to return 400 for invalid values.

**Acceptance:** Invalid state values fail at API and database layers.

### Task 1.5 — Add RLS negative tests

**Files:**
- Modify/create: `apps/platform/tests/security/*.test.ts`

**Work:** Cover anonymous REST reads, authenticated cross-org reads, cross-org writes, same-org member access, and admin-only mutations.

**Acceptance:** Security suite proves no cross-org data access and no anonymous module-table access.

**Commit boundary:** `security: enforce database tenant isolation with RLS`

---

## Phase 2 — Network and secrets hardening (P0)

### Task 2.1 — Close public PostgreSQL access

**Files:**
- Modify: `docker/docker-compose.yml`
- Modify: host firewall configuration through approved operations
- Update: `README.md` deployment notes

**Work:** Bind Postgres to localhost or a controlled private interface. Remove public UFW allow for `35432`. Preserve CI migration access through an explicit secure route, not a global port.

**Acceptance:** External connection to `35432` fails; local application and controlled CI migration path still work.

### Task 2.2 — Review internal service bindings

**Work:** Review `38080`, `38081`, and `8088`. Bind internal services to localhost/private networks and expose only intended public routes through the reverse proxy.

**Acceptance:** Public scan cannot reach PostgREST, GoTrue, Studio, or raw nginx ports directly.

### Task 2.3 — Verify secret hygiene and rotation status

**Work:** Audit `.env`, Docker secrets, Cloudflare credentials, Stripe secrets, and Git history. Confirm no service-role keys or webhook secrets are tracked. Record pending owner rotations.

**Acceptance:** Secret scan is clean; all production secrets have an owner and rotation date.

### Task 2.4 — Add security headers and request limits

**Work:** Confirm CSP/security headers, auth endpoint rate limits, demo provisioning limits, payload size limits, and origin checks.

**Acceptance:** `/api/demo/start`, login, signup, and OTP endpoints cannot be trivially abused.

**Commit boundary:** `security: close exposed infrastructure and harden ingress`

---

## Phase 3 — Authorization and tenant-context hardening (P0)

### Task 3.1 — Inventory every API route and authorization decision

**Work:** Generate a route matrix covering auth, org selection, module reads, mutations, demo lifecycle, cron, and billing. Record required auth, org, module, and role.

**Acceptance:** Every route has an explicit authorization decision; no route relies on implicit defaults.

### Task 3.2 — Remove client-trusted organization context

**Work:** Review `server/middleware/01.session.ts`, `02.org-context.ts`, `utils/auth.ts`, and org selection. Ensure headers/cookies can only select among memberships verified server-side.

**Acceptance:** A user cannot select an organization where they lack an active membership.

### Task 3.3 — Standardize admin-client access

**Work:** Centralize service-role access behind a typed server utility. Require an explicit organization predicate for every module query. Add a review helper/test that flags module queries missing organization scope.

**Acceptance:** No direct unscoped module-table query remains in API handlers.

### Task 3.4 — Add authorization regression tests

**Acceptance:** Every mutation endpoint has happy-path, unauthenticated, wrong-org, and wrong-role tests.

**Commit boundary:** `security: harden authorization and organization context`

---

## Phase 4 — Production data safety and observability (P1)

### Task 4.1 — Configure automated Postgres backups

**Work:** Implement encrypted daily backups with retention, failure alerts, and a documented restore command.

**Acceptance:** Backup job succeeds and produces a verifiable artifact outside the database host.

### Task 4.2 — Perform a restore drill

**Work:** Restore the latest backup into an isolated database/container. Verify schema, RLS, and representative records.

**Acceptance:** Restore completes from documented instructions with measured RTO/RPO.

### Task 4.3 — Add application error monitoring

**Work:** Configure Sentry or equivalent for server/client errors, with secrets excluded and environment tags.

**Acceptance:** A controlled test error appears in monitoring without leaking tokens or personal data.

### Task 4.4 — Add health/readiness endpoints

**Work:** Add separate liveness and readiness checks for app, PostgREST, Auth, and database connectivity. Do not expose sensitive diagnostics publicly.

**Acceptance:** Health checks distinguish app-up/database-down from fully ready.

**Commit boundary:** `ops: add backups observability and readiness checks`

---

## Phase 5 — SaaS account and billing lifecycle (P1)

### Task 5.1 — Define workspace activation states

**Work:** Document and implement trial, active, suspended, cancelled, and expired transitions. Ensure middleware and UI agree.

**Acceptance:** Every state has explicit API/UI behavior and tests.

### Task 5.2 — Implement owner/admin workspace controls

**Work:** Add workspace settings, membership management, role assignment, invite/revoke flow, and ownership safeguards.

**Acceptance:** Owner can manage an organization without direct database intervention.

### Task 5.3 — Reintroduce Stripe only after security gates pass

**Work:** Create products/prices, checkout, webhook signature verification, idempotent event handling, subscription sync, and cancellation flow.

**Acceptance:** Test-mode checkout changes workspace state correctly; duplicate/out-of-order webhook events are harmless.

**Commit boundary:** `feat: implement production workspace and billing lifecycle`

---

## Phase 6 — Module completeness and public website (P1)

### Task 6.1 — Finish PEOPLE production workflow

**Work:** Search, filtering, pagination, member detail, edit, archive, import/export, and audit fields.

### Task 6.2 — Finish JOURNEY production workflow

**Work:** Track editor, publish/archive, prerequisites, enrollment management, mentor assignment, progress, and completion rules.

### Task 6.3 — Finish PAGES production workflow

**Work:** Page editor, blocks/content model, draft/publish states, preview, public renderer, slug routing, and custom-domain mapping.

### Task 6.4 — Add module endpoint coverage

**Acceptance:** Every endpoint has happy-path, validation, unauthenticated, wrong-role, and cross-org tests.

**Commit boundary:** `feat: complete production module workflows`

---

## Phase 7 — Deployment, performance, and launch verification (P1)

### Task 7.1 — Build CI quality gates

**Work:** Require lint, typecheck, tests, build, migration checks, secret scan, and RLS security tests before deploy.

### Task 7.2 — Run performance and capacity tests

**Work:** Test representative API requests, demo provisioning, login, page rendering, and 50+ organization concurrency target.

**Acceptance:** Record p95 latency, error rate, memory, and CPU; define hard limits.

### Task 7.3 — Run external smoke tests

**Work:** Test marketing site, auth, demo flow, dashboard, module CRUD, public page, logout/reset, and subscription state from outside the VPS.

### Task 7.4 — Final launch gate

**Acceptance:**
- RLS and negative tests pass.
- Public database ports closed.
- Backup restore verified.
- Monitoring alert verified.
- CI gates green.
- No critical/high unresolved findings.
- Git clean and deployment rollback documented.

**Commit boundary:** `chore: certify ChurchOS SaaS launch readiness`

---

## Tracking rules

- Only one implementation task is marked `in_progress` at a time.
- Every code task gets a failing test or explicit security regression test first.
- Every phase ends with build/test/security verification and a git commit.
- Do not onboard real church data until Phase 1 and Phase 2 are complete.
- Keep this plan and the todo tracker synchronized after every task.
