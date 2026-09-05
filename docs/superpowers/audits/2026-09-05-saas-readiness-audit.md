# ChurchOS SaaS-Readiness Audit (2026-09-05)

| Field | Value |
| --- | --- |
| Scope | Platform API + UI, database schema, docs accuracy |
| Trigger | Question: do we have full functions for all modules and all possible CRUD for a SaaS-ready platform? |
| Code state | Commit `b75675c` + uncommitted docker hardening (compose auth credential parameterization) |
| Verification | typecheck ✅ · 41/41 tests ✅ · lint ✅ · builds ✅ · local stack healthy · demo flow end-to-end ✅ |

## Answer in one line

**No — the platform is a working demo-first MVP with real CRUD in all three modules, but only Create + List are implemented everywhere.** Update, Read-by-id, and Delete are missing in PEOPLE and JOURNEY, and PAGES has a publish-toggle only. The design spec's full module scope (donations, events, groups, certificates, page builder, public websites) is not built. Details below.

---

## 1. Current implementation inventory (verified against code, not plans)

### Module gating
- `requireModule(event, 'people' | 'journey' | 'pages')` in `server/utils/auth.ts` — real module gating exists and is applied to every module endpoint. ✅
- Demo sandboxes get all modules subscribed (`demo.ts` seeds `subscribed_modules: ['people','journey','pages']`). ✅

### Database (8 tables live: organizations, profiles, organization_members, members, tracks, enrollments, pages, schema_migrations)
| Module | Tables | Status |
| --- | --- | --- |
| PEOPLE | `members` | Only table exists. Donations, events, event_registrations, groups, attendance, volunteers: **not built** |
| JOURNEY | `tracks`, `enrollments` | Only 2 of ~7 planned tables. Modules, lessons, lesson_progress, quizzes, certificates: **not built** |
| PAGES | `pages` | Single flat table (slug, 4 titles, published). page_blocks, website_settings, social links, backgrounds: **not built** |

### API endpoints (all org-scoped via middleware; all gated by module)
| Route | Method | Exists | Notes |
| --- | --- | --- | --- |
| `/api/auth/signup` · `login` · `logout` · `me` · `set-session` | GET/POST | ✅ | Demo-first auth flow; `auth/demo` provisions sandbox |
| `/api/demo/start` · `reset` | POST | ✅ | Provision/wipe/reseed isolated demo org (8 members, 3 tracks, 3 pages) |
| `/api/org/select` | POST | ✅ | Org switcher |
| `/api/organizations` (create) · `current` | GET/POST | ✅ | Activation flow = manual/owner-led (inactive → active) |
| `/api/people` | GET, POST | ✅ | List (org-scoped) + create member |
| `/api/people/[id]` PATCH/DELETE | — | ❌ | **No member edit, no archive** |
| `/api/journey/tracks` | GET, POST | ✅ | List + create track |
| `/api/journey/tracks/[id]` PATCH/DELETE | — | ❌ | No track edit/publish/delete |
| `/api/journey/enrollments` | GET | ✅ | List only — **no enroll endpoint** |
| `/api/pages` | GET, POST | ✅ | List + create page |
| `/api/pages/[id]` | PATCH | ✅ | **Only `published` toggle** — no title/slug/content edit, no delete |
| `/api/cron/check-subscriptions` | GET | ✅ | Demo-sandbox sweeper (24h) |
| Billing (Stripe) | — | ❌ | Removed by demo-first pivot; owner-led activation replaces it |

### UI pages (11 pages)
- **Working:** `auth/{login,signup,verify-otp,demo}`, `dashboard`, `organizations/new`, `people`, `journey`, `pages`, `account/billing` (repurposed to workspace status page — consistent with pivot, linked from layouts/dashboard/journey/pages).
- **Missing:** member detail/edit, track detail/edit, page editor, org settings, user profile settings.

### Test coverage
- 5 test files, 41 tests: auth, organizations, people (list/create), tracks (list/create), pages (list/create + publish toggle). No tests for demo endpoints, cron sweeper, or org/select.

### Docs state (this audit's corrections)
- `plans/README.md` still describes Plan 2/3/4 as "to be written" while a combined Phase 2–4 plan exists and is partially executed; Plan 5 is marked superseded. Updated in this pass.
- Design spec success outcome still describes the Stripe/trial journey; demo-first model supersedes parts of it (spec section updated with a pointer).

---

## 2. Gaps to "SaaS-ready" (requirements)

### A. CRUD completeness (per module)
| Module | To reach full CRUD |
| --- | --- |
| PEOPLE | `GET /people/:id`, `PATCH /people/:id` (member_status, contact fields), `DELETE /people/:id` (soft-delete → `member_status: 'former'`), search/filter/pagination on list |
| JOURNEY | `PATCH /tracks/:id` (publish, edit, prerequisite), `DELETE /tracks/:id` (blocked if enrollments exist), `POST /enrollments` (with prerequisite check), `PATCH /enrollments/:id` (status, mentor assignment) |
| PAGES | `GET /pages/:id`, `PATCH /pages/:id` extended to title/slug/published, `DELETE /pages/:id` (unpublish first), block-based content model (`page_blocks` table) |

### B. Platform requirements (SaaS table stakes, missing entirely)
1. **Role-based access is declared but not enforced per endpoint** — `requireRole()` exists in `utils/auth.ts` but no module endpoint calls it; every module action is available to any org member. Require `admin` for all mutations, `member` for reads.
2. **Workspace activation UX** — workspaces start `inactive`; only an owner-side action flips to active. No admin UI/tooling for the owner to activate a paying church.
3. **Rate limiting / abuse protection** on public endpoints (`/api/demo/start` especially — each call provisions a full org).
4. **Ratings/validation** — schema has no CHECK constraints on enums (`member_status`, `track.status`, `subscription_status`); enforce at DB or API layer.
5. **Public website rendering** — PAGES has no public renderer (`{slug}.churchos.my` or custom domains) — the actual customer deliverable of the PAGES module.
6. **Email (Resend)** — signup OTP exists via Supabase Auth, but invites/notifications are unbuilt.
7. **Realtime, Storage, OAuth (Google), Mobile OTP** — declared in the spec stack, none implemented.
8. **Backups/monitoring** — none configured for the self-hosted Supabase on the VPS.

### C. Security posture (current state)
- ✅ Multi-tenant isolation: every query filters `organization_id` from `event.context.org` (server-derived, not client-supplied).
- ✅ Demo org lifecycle: isolated sandboxes, cascade wipe on logout/24h sweeper.
- ⚠️ Admin-client pattern: endpoints use the service key with manual org filtering rather than RLS-backed user tokens — isolation depends entirely on each handler remembering `.eq('organization_id', ...)`.
- ⚠️ Secrets rotation completed 2026-09-05 (see rotation report in session history); firewalling of ports 35432/33001 still open items.

---

## 3. Success metrics

### Current baseline (2026-09-05)
| Metric | Value |
| --- | --- |
| Modules with working UI | 3/3 |
| CRUD operations implemented | 8 of ~21 required (List+Create ×3 modules, publish toggle, org create/select, auth flows) |
| Endpoints behind module gating | 100% |
| Tests | 41 passing (0 demo-flow tests) |
| Demo sandbox lifecycle | start → seed → resume → reset → wipe: all verified |
| Multi-tenant isolation tests | organizations.test.ts (cross-org denial verified) |

### Targets for SaaS-ready (per module)
| Metric | Current | SaaS-ready target |
| --- | --- | --- |
| PEOPLE CRUD | 2 ops | 6 ops (list/create/read/update/archive) + search/pagination |
| JOURNEY CRUD | 2 ops | 7 ops (tracks CRUD + enroll/status endpoints) |
| PAGES CRUD | 2 ops | 6 ops (incl. content edit + delete) + public renderer |
| Role enforcement | 0 endpoints | 100% of mutation endpoints require `admin` |
| DB enum constraints | 0 CHECKs | All status columns constrained |
| Public site render | none | `{slug}.churchos.my` + custom domain SSR |
| Test coverage | 41 tests | Every endpoint has at least happy-path + cross-org denial test |
| Demo abuse protection | none | Rate limit on `/api/demo/start` (e.g. 5/day/IP) |

### Launch-gate metrics (owner-facing)
1. A church can complete: signup → workspace → activation → add member → edit member → create track → enroll → publish page → **see it on their subdomain**.
2. Zero cross-org data leakage in test suite (enforced by CI).
3. p95 API latency < 300ms on VPS hardware; stack restarts recover automatically (`restart: unless-stopped`).
4. Demo sandbox cost bounded: ≤ 100 concurrent demo orgs (sweeper + rate limit).

---

## 4. Unfinished tasks / loose ends (from all sessions)

1. **Uncommitted changes:** `docker/docker-compose.yml` + `docker/.env.example` — auth-service credential parameterization (`SUPABASE_AUTH_DB_PASSWORD`), verified working after the 2026-09-05 rotation. Ready to commit.
2. **Firewall** ports 35432 (Postgres) and 33001 (Studio) remain internet-open on the VPS.
3. **Rotations still pending owner action:** Stripe webhook secret, Cloudflare API token (dashboards only).
4. **`.commandcode/`** untracked local tooling config — add to `.gitignore` or commit deliberately.
5. **Docs drift:** plans README + design spec updated in this pass; the Phase 2–4 plan file's task lists are aspirational, not checked off — update as work lands.
6. **Test gap:** demo endpoints (`/api/demo/start|reset`, logout wipe) have zero automated tests despite being the product's front door.
