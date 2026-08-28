# ChurchOS Implementation Plan — Phase 2–4: Modules & Multi-tenancy (2026-08-28 →)

> **Supersedes:** `2026-08-24-foundation-infrastructure.md` (Phase 1 — complete)
>
> **Status of Phase 1:** ✅ All 15 tasks committed. CI passes (lint, typecheck, 26 tests, build). Git log ends at `f469a2d`.
>
> **Goal:** Implement the three core modules (PEOPLE, JOURNEY, PAGES) end-to-end on the existing foundation — schema → server utils → API endpoints → UI pages → tests. Each phase delivers a usable, deployable slice verified by `pnpm check` + Vitest.
>
> **Agentic guidance:** Use `superpowers:subagent-driven-development` per phase. Each phase has its own verification gate (tests must pass, `pnpm check` must be green).
>
> **Constraints (carried from Phase 1):**
> - Node `>=24.11.0 <25`, pnpm `11.19.0`
> - Every module table gets `organization_id` + RLS
> - Subdomain: `{slug}.churchos.my`
> - DB password 32+ chars; secrets never committed

---

## What exists now

```
churchos/
├── apps/
│   ├── marketing/          # ✅ static landing (app.vue + nuxt.config.ts)
│   └── platform/           # ✅ Nuxt 4 shell, auth + org middleware, 4 API endpoints
│       ├── server/
│       │   ├── middleware/01.session.ts, 02.org-context.ts  ✅
│       │   ├── utils/supabase.ts, auth.ts, cloudflare.ts    ✅
│       │   ├── api/auth/{login,signup,logout,me}             ✅
│       │   └── api/organizations/index.post.ts               ✅
│       └── tests/api/{auth,organizations}.test.ts            ✅ (Vitest)
├── packages/database/      # ✅ @churchos/database (client + types)
├── supabase/migrations/    # ✅ 2 migrations (schema + RLS)
├── docker/                 # ✅ docker-compose.yml + nginx + .env
├── docs/superpowers/        # spec + this plan
└── .github/workflows/      # ✅ ci.yml + platform-deploy.yml
```

---

## Phase 2 — PEOPLE Module: Member Management (Weeks 5–7)

**Goal:** Full member CRUD with invitation flow, member roles, and subscription status display. Admin can view/edit members; members see their own profile.

### 2.1 Schema (`supabase/migrations/20260828000003_people.sql`)

| Table | Fields |
|---|---|
| `members` | `id`, `organization_id`, `user_id` (nullable), `member_number`, `first_name`, `last_name`, `date_of_birth`, `gender`, `marital_status`, `phone`, `email`, `address` (jsonb), `emergency_contact_name`, `emergency_contact_phone`, `baptism_date`, `membership_date`, `member_status` (active/inactive/former), `photo_url`, `created_at`, `updated_at` |
| `donations` | `id`, `organization_id`, `member_id`, `amount` (decimal), `currency` (MYR), `donation_type` (tithe/offering/building_fund/missions), `payment_method`, `transaction_date`, `notes`, `created_at` |
| `events` | `id`, `organization_id`, `title`, `description`, `event_type`, `start_at`, `end_at`, `location`, `max_capacity`, `registration_required`, `created_at`, `updated_at` |
| `event_registrations` | `id`, `organization_id`, `event_id`, `member_id`, `registered_at`, `checked_in_at` (nullable), `status` (registered/attended/cancelled) |

**RLS policies:** standard org-isolation (select for org members; insert/update/delete for admins). Donations: members see own; admins see all in org.

### 2.2 Server utils

- `packages/database/src/types.ts` → add `Member`, `Donation`, `Event`, `EventRegistration`, `MemberStatus`
- `server/utils/supabase.ts` → already has admin + per-request client; extend if needed

### 2.3 API endpoints (`server/api/people/`)

| Endpoint | Auth | Description |
|---|---|---|
| `GET /people/members` | 401 | List members (org-scoped) — query params: `?status=active&search=kw&page=n` |
| `POST /people/members` | 403 | Create member (admin) |
| `GET /people/members/:id` | 401 | Get member detail |
| `PATCH /people/members/:id` | 403 | Update member (admin) |
| `DELETE /people/members/:id` | 403 | Soft-delete (set status → 'inactive') |
| `POST /people/members/invite` | 403 | Send invite via Resend → creates member + sends email with join link |
| `GET /people/donations` | 401 | List donations (own or org-wide) |
| `GET /people/events` | 401 | List events |
| `POST /people/events` | 403 | Create event (admin) |
| `POST /people/events/:id/register` | 401 | Register member for event |
| `POST /people/events/:id/checkin` | 403 | Mark attendance (admin) |

### 2.4 UI pages

| Route | Component | Notes |
|---|---|---|
| `/app/(people)/members` | `pages/people/members/index.vue` | DataTable: name, phone, email, status, member_since. Toolbar: Invite, Export CSV. |
| `/app/(people)/members/[id]` | `pages/people/members/[id].vue` | Detail view: tabs (Profile, Donations, Events). Edit button (admin). |
| `/app/(people)/members/new` | `pages/people/members/new.vue` | Form: text, date, select, file upload for photo. |
| `/app/(people)/donations` | `pages/people/donations/index.vue` | List with filters (type, date range). Total this month badge. |
| `/app/(people)/events` | `pages/people/events/index.vue` | Calendar or list view. Upcoming / Past tabs. |
| `/app/(people)/events/[id]` | `pages/people/events/[id].vue` | Event detail + attendee list + check-in QR. |

**Reusable composables:**
- `composables/useMembers.ts` — CRUD + pagination
- `composables/useDonations.ts`
- `composables/useEvents.ts`
- Extend `composables/useSubscription.ts` → `hasModule('people')`

### 2.5 Tests (`tests/api/people.test.ts`)

- Member CRUD: create → read → update → soft-delete → verify
- RLS isolation: user in org A cannot see org B members
- Invitation: POST invite → email queued (mock Resend)
- Event registration: check-in sets `checked_in_at`
- 10–12 tests

### 2.6 Verification gate

- ✅ New migration applies cleanly (`docker exec -i churchos-db psql -U postgres < migration`)
- ✅ `pnpm --filter platform typecheck`
- ✅ `pnpm --filter platform test` (all pass, including 2.5)
- ✅ Manual smoke: `pnpm --filter platform dev` → login → /people/members loads

---

## Phase 3 — JOURNEY Module: Discipleship LMS (Weeks 8–11)

**Goal:** Tracks → Modules → Lessons with bilingual content, enrollments with mentor assignment, quiz system, progress tracking, certificate generation, and cross-org certificate visibility.

### 3.1 Schema (`supabase/migrations/20260828000004_journey.sql`)

| Table | Fields |
|---|---|
| `tracks` | `id`, `organization_id`, `slug`, `name_en`, `name_zh`, `description_en`, `description_zh`, `prerequisite_track_id`, `is_active`, `created_at`, `updated_at` |
| `track_modules` | `id`, `organization_id`, `track_id`, `title_en`, `title_zh`, `sort_order`, `is_required` |
| `lessons` | `id`, `organization_id`, `track_module_id`, `title_en`, `title_zh`, `content_en` (Tiptap JSON), `content_zh`, `duration_minutes`, `sort_order`, `is_published` |
| `quizzes` | `id`, `organization_id`, `lesson_id`, `title`, `passing_score` (default 70) |
| `quiz_questions` | `id`, `quiz_id`, `question_text`, `question_type` (multiple_choice/single_choice/true_false), `sort_order` |
| `quiz_options` | `id`, `quiz_question_id`, `option_text`, `is_correct` |
| `enrollments` | `id`, `organization_id`, `track_id`, `mentee_id` (member_id), `mentor_id` (member_id, nullable), `status` (active/completed/dropped), `enrolled_at`, `completed_at`, `mentor_approved_at` |
| `lesson_progress` | `id`, `organization_id`, `enrollment_id`, `lesson_id`, `status` (not_started/in_progress/completed), `started_at`, `completed_at`, `time_spent_minutes` |
| `quiz_attempts` | `id`, `organization_id`, `enrollment_id`, `quiz_id`, `score`, `passed`, `attempt_number`, `started_at`, `completed_at` |
| `certificates` | `id`, `organization_id`, `track_id`, `user_id`, `certificate_number` (unique), `issued_at`, `template_data` (jsonb snapshot), `revoked`, `revoked_reason`, `revoked_at` |

**RLS:** standard org-isolation for all. `certificates` has special cross-org SELECT policy (users see own; org admins see members in their org).

### 3.2 Server utils

- Add `Track`, `TrackModule`, `Lesson`, `Quiz`, `Enrollment`, `Certificate` to `packages/database/src/types.ts`
- `server/utils/journey.ts` — helpers: `generateCertificateNumber()`, `checkPrerequisites(menteeId, trackId)`, `issueCertificate(enrollmentId)`

### 3.3 API endpoints (`server/api/journey/`)

| Endpoint | Auth | Description |
|---|---|---|
| `GET /journey/tracks` | 401 | List active tracks (org-scoped) |
| `POST /journey/tracks` | 403 | Create track (admin) |
| `GET /journey/tracks/:id` | 401 | Track detail + modules + lessons tree |
| `POST /journey/enrollments` | 403 | Enroll member (checks prerequisites) |
| `GET /journey/enrollments` | 401 | User's enrollments (mentee or mentor view) |
| `PATCH /journey/enrollments/:id/assign-mentor` | 403 | Assign mentor |
| `POST /journey/lessons/:id/progress` | 401 | Mark lesson started/completed |
| `POST /journey/quizzes/:id/attempt` | 401 | Submit quiz → score + pass/fail |
| `POST /journey/enrollments/:id/certificate` | 403 | Issue certificate (on completion) |
| `GET /journey/certificates` | 401 | List certificates (cross-org: own only; admin sees org members) |

### 3.4 UI pages

| Route | Component | Notes |
|---|---|---|
| `/app/(journey)/tracks` | `pages/journey/tracks/index.vue` | Card grid: track name, description, modules count, enrollment status badge. |
| `/app/(journey)/tracks/[id]` | `pages/journey/tracks/[id].vue` | Track detail: modules → lessons tree. Enroll button (prerequisite check). |
| `/app/(journey)/my-journey` | `pages/journey/my-journey/index.vue` | Mentee view: enrolled tracks, progress %, certificates. |
| `/app/(journey)/mentoring` | `pages/journey/mentoring/index.vue` | Mentor view: assigned mentees, pending reviews. |
| `/app/(journey)/lessons/[id]` | `pages/journey/lessons/[id].vue` | Lesson player: content (Tiptap-rendered), quiz below if any. Next/previous nav. |
| `/app/(journey)/certificates` | `pages/journey/certificates/index.vue` | Certificate list: downloadable PDF. |

**Reusable composables:**
- `composables/useTracks.ts`
- `composables/useEnrollments.ts`
- `composables/useLessonProgress.ts`
- `composables/useQuizzes.ts`
- `composables/useCertificates.ts`

### 3.5 Tests (`tests/api/journey.test.ts`)

- Prerequisite check: enroll in track with unmet prereq → 400
- Lesson progress: start → complete → verify timestamp
- Quiz scoring: submit all-correct → passed=true; submit all-wrong → passed=false
- Cross-org certificates: user A's cert visible to admin of org B (where A is a member); NOT visible to org C
- Certificate issuance: mark enrollment complete → cert created with unique number
- 12–14 tests

### 3.6 Verification gate

- ✅ New migration applies
- ✅ `pnpm --filter platform typecheck`
- ✅ `pnpm --filter platform test`
- ✅ Manual smoke: enroll in a track, complete a lesson, pass a quiz, issue cert

---

## Phase 4 — PAGES Module: Website Builder (Weeks 12–14)

**Goal:** Multi-templated, multilingual church website builder with block-based editing, background customization, social media links, and public SSR rendering on tenant subdomains.

### 4.1 Schema (`supabase/migrations/20260828000005_pages.sql`)

| Table | Fields |
|---|---|
| `website_settings` | `id` (PK, fixed to org), `organization_id`, `template_id` (modern-minimal/warm-community/next-generation), `primary_color`, `logo_url`, `favicon_url`, `contact_email`, `contact_phone`, `contact_address`, `custom_css`, `custom_tailwind_config` (jsonb), `created_at`, `updated_at` |
| `pages` | `id`, `organization_id`, `slug`, `title_en`, `title_zh`, `title_ms`, `title_ta`, `content_en` (Tiptap JSON), `content_zh`, `content_ms`, `content_ta`, `background_type` (solid/gradient/image/none), `background_solid_color`, `background_gradient` (jsonb), `background_image_url`, `background_image_settings` (jsonb), `published` (boolean), `is_homepage` (boolean), `sort_order`, `created_at`, `updated_at` |
| `page_blocks` | `id`, `organization_id`, `page_id`, `block_type` (richtext/hero/questions/contact_form/video/image_gallery/sermon_list/custom_html), `content_en`, `content_zh`, `content_ms`, `content_ta` (jsonb), `custom_html`, `custom_css`, `background_*`, `sort_order`, `created_at`, `updated_at` |
| `social_media_links` | `id`, `organization_id`, `platform` (facebook/instagram/youtube/tiktok/linkedin/whatsapp/telegram/spotify/apple_podcasts/custom), `handle`, `url`, `position`, `created_at`, `updated_at` |

**RLS:** standard org-isolation. `pages` + `page_blocks` + `website_settings` + `social_media_links` all org-scoped.

**Public rendering:** a dedicated `server/routes/website/[slug].ts` (or middleware-based route) renders pages with NO auth required (public website) — reads org by slug, applies template + settings.

### 4.2 Server utils

- Add `WebsiteSettings`, `Page`, `PageBlock`, `SocialMediaLink`, `TemplateId` to `packages/database/src/types.ts`
- `server/utils/pages.ts` — `renderPageForWebsite(slug, lang)`, `sanitizeCustomHtml(html)`, `sanitizeCustomCss(css)`
- DOMPurify import for sanitization

### 4.3 API endpoints (`server/api/pages/`)

| Endpoint | Auth | Description |
|---|---|---|
| `GET /pages` | 403 | List org pages (admin only) |
| `POST /pages` | 403 | Create page |
| `GET /pages/:slug` | 403 | Get page (admin) — for editing |
| `PATCH /pages/:slug` | 403 | Update page |
| `POST /pages/:slug/publish` | 403 | Toggle published |
| `GET /pages/:slug/blocks` | 403 | List blocks for page |
| `POST /pages/:slug/blocks` | 403 | Create block |
| `PATCH /pages/blocks/:id` | 403 | Update block |
| `DELETE /pages/blocks/:id` | 403 | Delete block |
| `GET /pages/website-settings` | 403 | Get org website settings |
| `PATCH /pages/website-settings` | 403 | Update settings |
| `GET /pages/social-links` | 403 | List social links |
| `POST /pages/social-links` | 403 | Create social link |

**Public route:** `GET /{orgSlug}.churchos.my/[...slug]` → `server/routes/website/_render.ts` → SSR page with template + settings (no auth)

### 4.4 UI pages (admin builder)

| Route | Component | Notes |
|---|---|---|
| `/app/(pages)/pages` | `pages/pages/index.vue` | Page list: title, slug, published status, sort_order drag-handle. |
| `/app/(pages)/pages/[slug]` | `pages/pages/[slug].vue` | Page editor: sidebar (settings + blocks list) | main (live preview in iframe). Save, publish buttons. |
| `/app/(pages)/blocks/[id]` | `pages/pages/blocks/[id].vue` | Block editor modal: block-type selector, content tabs (EN/ZH/MS/TA), background settings, custom HTML/CSS editor (Monaco). |
| `/app/(pages)/website-settings` | `pages/pages/website-settings.vue` | Template selector, color picker, logo/favicon upload, contact info, custom CSS/Tailwind. |
| `/app/(pages)/social-links` | `pages/pages/social-links.vue` | Platform dropdown + handle input. URL auto-generated. Drag-to-reorder. |

**Reusable composables:**
- `composables/usePages.ts`
- `composables/useBlocks.ts`
- `composables/useWebsiteSettings.ts`
- `composables/useSocialLinks.ts`

### 4.5 Tests (`tests/api/pages.test.ts`)

- Page CRUD with multilingual content
- Block add/update/delete on a page
- Background settings JSON round-trip
- Website settings per-org isolation
- Social link URL auto-generation from platform + handle
- Public render: published page returns 200 with content; unpublished returns 404; cross-org returns 404
- 10–12 tests

### 4.6 Verification gate

- ✅ New migration applies
- ✅ `pnpm --filter platform typecheck`
- ✅ `pnpm --filter platform test`
- ✅ Manual smoke: create a page, add blocks, publish, visit `{org}.churchos.my/{page-slug}` → page renders with template

---

## Shared deliverables across all three phases

### Type safety
- All new DB tables → interfaces in `packages/database/src/types.ts` (no inline types in endpoints)
- Every endpoint uses `event.context.org` / `event.context.user` (set by existing middleware)
- `requireModule(event, 'people'|'journey'|'pages')` guards every module endpoint

### Testing standards
- Vitest + `@nuxt/test-utils` for API tests (mirrors `tests/api/auth.test.ts` structure)
- At minimum 8 new tests per phase; cross-module edge cases where they interact
- Negative tests: RLS isolation between orgs (user in A cannot read B's data)

### Code patterns (follow existing conventions)
- `server/api/<module>/<resource>/<method>.ts`
- `server/utils/<module>.ts` for domain helpers
- `composables/use<Module>.ts` for client-side data fetching
- `server/routes/website/_render.ts` for public PAGES rendering
- 2-space indent, double quotes, `export default defineEventHandler`

### CI compatibility
- All new code must pass `pnpm check` (lint + typecheck + test + build) before Phase gate
- New migrations must be idempotent and apply cleanly with `supabase db push` (remote) and `psql < migration` (local)
- No secrets in code; all env vars read via `useRuntimeConfig()`

---

## Phase completion checklist

| Phase | Schema | API | UI | Tests | Manual smoke | `pnpm check` |
|---|---|---|---|---|---|---|
| Phase 2 (PEOPLE) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Phase 3 (JOURNEY) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Phase 4 (PAGES) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## Out of scope for this plan

- Stripe billing integration (Phase 5)
- Plugin SDK + marketplace (Phase 7)
- Native mobile app
- Prayer Wall plugin
- Sermon Manager + Whisper transcription
- Facial Recognition / LPR attendance (Pro tier)
- All 21 Phase 2+ plugins listed in the spec

These remain documented in `2026-08-24-churchos-multi-tenant-design.md` for future phases.
