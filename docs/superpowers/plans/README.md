# ChurchOS Implementation Plans

This directory contains bite-sized implementation plans for the ChurchOS multi-tenant platform.

**Design Spec:** `../specs/2026-08-24-churchos-multi-tenant-design.md`

---

## Execution Order

Plans should be executed in sequence as each builds on the previous:

### ✅ Plan 1: Foundation & Infrastructure (COMPLETE)
**File:** `2026-08-24-foundation-infrastructure.md`  
**Status:** Written, ready for execution  
**Duration:** 2-3 weeks  
**Delivers:**
- Monorepo setup (pnpm workspaces)
- Docker Supabase stack (Postgres, PostgREST, Realtime, Storage)
- Core database schema (organizations, profiles, organization_members)
- RLS policies for multi-tenancy
- Supabase Auth (email/password, Google OAuth, mobile OTP)
- Session + org-context middleware
- Organization creation with Cloudflare subdomain provisioning
- Dashboard with org switcher
- CI/CD workflows

**Blockers:** None - can start immediately

---

### 🔜 Plan 2: PEOPLE Module
**File:** `2026-08-25-people-module.md` (to be written)  
**Duration:** 3-4 weeks  
**Delivers:**
- Member management (CRUD, profiles, emergency contacts)
- Invitation system (email invites via Resend)
- Donations tracking (tithes, offerings, funds)
- Giving statements generation
- Events (create, manage, registrations, check-ins)
- Groups (cell groups, ministries, committees)
- Group attendance tracking
- Volunteer management

**Prerequisites:**
- Plan 1 complete (organizations, auth, middleware)

**Key Tasks:**
1. Database migrations (members, donations, events, groups tables + RLS)
2. Member CRUD API + UI
3. Donation tracking API + UI
4. Events with registration API + UI
5. Groups + attendance API + UI
6. Role-based access (admin vs member views)

---

### 🔜 Plan 3: JOURNEY Module
**File:** `2026-08-25-journey-module.md` (to be written)  
**Duration:** 4-5 weeks  
**Delivers:**
- Tracks, modules, lessons (bilingual EN/ZH)
- Lesson player UI (from DOVES patterns)
- Enrollments with mentor assignment
- Lesson progress tracking
- Quiz system (objective questions, scoring)
- Mentor review workflow
- Certificate generation with templates
- Cross-org certificate visibility
- Prerequisite checking for track enrollment

**Prerequisites:**
- Plan 1 complete (auth, orgs)
- Plan 2 complete (members table required for enrollments)

**Key Tasks:**
1. Database migrations (tracks, modules, lessons, enrollments, certificates + RLS)
2. Track/module/lesson CRUD API + UI (admin)
3. Lesson player UI (mentee view)
4. Quiz builder + quiz-taking UI
5. Mentor review interface
6. Certificate templates + issuance
7. Cross-org certificate query API

---

### 🔜 Plan 4: PAGES Module
**File:** `2026-08-25-pages-module.md` (to be written)  
**Duration:** 4-5 weeks  
**Delivers:**
- Page builder UI (block-based editing)
- 3 starter templates (Modern Minimal, Warm Community, Next Generation)
- Multilingual content (EN/ZH default, MS/TA in Pro)
- Background customization (solid/gradient/image with overlay/blur)
- Custom HTML + Tailwind blocks (Monaco editor)
- Social media links management (flexible platforms)
- Website settings (template, colors, logo)
- Public website rendering (SSR)
- Custom domain verification

**Prerequisites:**
- Plan 1 complete (orgs, auth, subdomain provisioning)

**Key Tasks:**
1. Database migrations (pages, page_blocks, website_settings, social_media_links + RLS)
2. Page list + CRUD API + UI
3. Block-based editor (Tiptap integration)
4. Background styling UI (color picker, gradient builder, image uploader)
5. Custom HTML/CSS editor (Monaco integration + sanitization)
6. Social media manager UI
7. Template selector + preview
8. Public website renderer (SSR with Nitro)

---

### 🔜 Plan 5: Billing & Subscriptions
**File:** `2026-08-25-billing-subscriptions.md` (to be written)  
**Duration:** 2-3 weeks  
**Delivers:**
- Stripe integration (checkout, webhooks)
- Subscription management (trials, active, suspended, cancelled)
- Module access gating (requireModule middleware)
- Pricing page UI
- Billing dashboard (invoices, payment history)
- Cron job for subscription checks (trial expiration, grace period)
- Reactivation fee calculation
- Email notifications (Resend integration)

**Prerequisites:**
- Plan 1 complete (orgs with subscription_status)
- Plans 2-4 complete (modules to subscribe to)

**Key Tasks:**
1. Database migrations (subscriptions, payment_history + RLS)
2. Stripe Checkout integration
3. Webhook handler (checkout.session.completed, invoice.*)
4. Pricing page UI
5. Billing dashboard UI
6. Cron job (Cloudflare Workers Cron Trigger)
7. Email templates (Resend)
8. Reactivation flow

---

### 🔜 Plan 6: Marketing Site
**File:** `2026-08-25-marketing-site.md` (to be written)  
**Duration:** 1-2 weeks  
**Delivers:**
- Landing page (hero, features, testimonials)
- Pricing page (with tier comparison)
- Features page (module details)
- About page
- Contact form
- SEO optimization
- Responsive design

**Prerequisites:**
- Plan 1 complete (deployment workflow)
- Plan 5 complete (pricing details)

**Key Tasks:**
1. Initialize apps/marketing (lightweight Nuxt app)
2. Landing page UI
3. Pricing page UI (dynamic from config)
4. Features page UI
5. Contact form (Resend integration)
6. SEO meta tags
7. Deploy to Cloudflare Pages (static)

---

## Plan Writing Guide

When writing Plans 2-6, follow this structure from `writing-plans` skill:

1. **Header** with goal, architecture, tech stack, spec reference
2. **Global Constraints** section
3. **File Structure** overview
4. **Tasks** with TDD steps:
   - Step 1: Write failing test
   - Step 2: Run test (verify failure)
   - Step 3: Write minimal implementation
   - Step 4: Run test (verify pass)
   - Step 5: Commit
5. **Acceptance Criteria** checklist

Each task should be 2-5 minute steps, independently testable.

---

## Total Timeline

**Phase 1 Launch:** ~16-20 weeks (4-5 months)

- Week 1-3: Foundation ✅
- Week 4-7: PEOPLE Module
- Week 8-12: JOURNEY Module
- Week 13-17: PAGES Module
- Week 18-20: Billing + Marketing

**Parallel execution possible:**
- PEOPLE, JOURNEY, PAGES can be built in parallel after Foundation (requires 3 developers)
- Billing must wait for all modules
- Marketing can start anytime after Foundation

---

## Next Steps

1. **Execute Plan 1** using `subagent-driven-development` skill
2. **Write Plan 2** when Plan 1 is 80% complete
3. **Execute Plans 2-4** in parallel if multiple developers available
4. **Execute Plans 5-6** sequentially

---

## Hermes Orchestrator Integration

For AI-driven parallel development:

1. Load Plan 1 → Break into daily task batches
2. Spawn agents per task ID
3. Agents execute TDD steps (write test → implement → commit)
4. Review checkpoints: after each Task completion
5. Proceed to next plan when acceptance criteria met

**Task ID format:** `P1-T01` (Plan 1, Task 1), `P2-T05` (Plan 2, Task 5)
**Parallelization:** Tasks within a plan can run parallel if no dependencies
**Daily brief:** Summary of completed tasks + next day's task queue

---

**Status:** Plan 1 written and ready. Plans 2-6 to be written as needed.
