# ChurchOS Multi-Tenant SaaS Platform - Design Specification

| Field | Value |
| --- | --- |
| Version | 1.0 |
| Status | Design approved, pending implementation plan |
| Date | 2026-08-24 |
| Owner | ChurchOS (independent) |
| Stack | Nuxt 4 + Nitro + Supabase + Cloudflare + Docker |

## Purpose

ChurchOS is a multi-tenant SaaS platform for Malaysian churches, offering modular church management tools with isolated data per organization, modular subscription pricing, and bilingual/multilingual support. It evolves the proven DOVES discipleship LMS architecture into a full Church Management System (ChMS) with community features, event management, donations, and people-centric website building.

## Success outcome

A prospective church explores the full product in a public demo sandbox (every visitor gets an isolated, pre-seeded workspace that resets when they sign out) → a church registers → receives an instant subdomain with an `inactive` workspace → the workspace is activated once a plan is arranged → subscribe to individual modules (PEOPLE, JOURNEY, PAGES) → manage members → run discipleship programs → publish a people-centric website. Users can belong to multiple churches, switch between them via dropdown, and carry JOURNEY certificates across organizations. The system serves 50-100 churches on a single VPS (4 vCPU, 7.8GB RAM) with self-hosted Supabase.

## Product scope

### Four products in one platform

1. **ChurchOS.my** - Marketing site (public, separate lightweight Nuxt app)
2. **PEOPLE** - Church Management System (members, donations, events, groups, volunteers)
3. **JOURNEY** - Discipleship LMS (tracks, enrollments, mentors, certificates) - includes basic member management
4. **PAGES** - People-centric church website builder with multilingual content

### Module subscriptions

Churches subscribe to modules individually or bundled. JOURNEY includes basic member data (required for enrollments). Full ChMS features require PEOPLE.

## Non-functional requirements

- Multi-tenant with strict `organization_id` isolation via Supabase RLS
- Users can belong to multiple organizations with role-based access per org
- 99.5% uptime SLA, graceful degradation
- Mobile-responsive from 320px to 1920px+
- Server-side authorization + RLS as independent data boundary
- Bilingual default (EN/ZH), Malay + Tamil in Pro tier
- Cross-org credential visibility for JOURNEY certificates
- Plugin architecture for future features (all opt-in, disabled by default)

---

## Architecture

### Stack

| Layer | Technology |
| --- | --- |
| Application | Nuxt 4, Vue 3, TypeScript, Nitro |
| Identity | Supabase Auth (Email/Password, Google OAuth, Mobile OTP) |
| Database | PostgreSQL (Supabase self-hosted via Docker) |
| Realtime | Supabase Realtime |
| File storage | Supabase Storage |
| Hosting | Cloudflare Pages (SSR for platform, static for marketing) |
| Payments | Stripe |
| Email | Resend |
| Domain provisioning | Cloudflare API + Registrar API |

### Monorepo structure (Approach A: Clean slate)

```
churchos/
├── apps/
│   ├── marketing/                # ChurchOS.my (lightweight, public)
│   └── platform/                 # Main SaaS (PEOPLE + JOURNEY + PAGES)
├── packages/
│   ├── database/                 # Supabase client, RLS helpers, types
│   ├── ui/                       # Shared Vue components (DOVES design system)
│   ├── i18n/                     # EN/ZH/MS/TA translations
│   ├── plugin-sdk/               # Plugin development kit
│   └── utils/                    # Shared utilities
├── supabase/
│   ├── migrations/               # Schema migrations
│   └── seed.sql                  # Demo data
├── docker/
│   ├── docker-compose.yml        # Self-hosted Supabase stack
│   └── nginx.conf                # Reverse proxy
├── docs/
│   ├── superpowers/
│   │   ├── specs/                # Design specs
│   │   └── plans/                # Implementation plans
│   └── architecture.md
└── pnpm-workspace.yaml
```

### Deployment topology

```
Cloudflare
├── churchos.my → Cloudflare Pages (marketing + platform SSR)
├── www.churchos.my → CNAME churchos.my (Pages)
├── app.churchos.my → CNAME churchos-platform.pages.dev (Pages, platform SSR)
├── *.churchos.my → CNAME churchos.my (Pages, for tenant subdomains)
├── db.churchos.my → VPS:33001 (Supabase Studio only, proxied)
└── Caddy routes any remaining subdomains to VPS services

VPS (4 vCPU, 7.8GB RAM) — serves only db.churchos.my (Studio)
├── PostgreSQL (2GB RAM)
├── PostgREST (512MB)
├── Realtime (512MB)
├── Storage (512MB)
├── Studio (256MB)
└── Nginx (128MB)
```

**DNS routing:**
- `churchos.my` → CNAME → `churchos-platform.pages.dev` (Pages)
- `app.churchos.my` → CNAME → `churchos-platform.pages.dev` (Pages)
- `{slug}.churchos.my` → CNAME → `churchos.my` → Pages (via Cloudflare API provisioning)
- `db.churchos.my` → A record → `YOUR_VPS_IP` → Caddy → `localhost:33001` (Studio)

---

## Database schema (multi-tenant)

All tables (except global lookup tables) include `organization_id`. RLS policies enforce isolation.

### Core multi-tenant tables

**organizations**
- `id` UUID PRIMARY KEY
- `slug` TEXT UNIQUE (for subdomain)
- `name` TEXT
- `custom_domain` TEXT UNIQUE (optional)
- `custom_domain_verified` BOOLEAN
- `subscription_tier` TEXT (starter/growth/pro)
- `billing_cycle` TEXT (monthly/annual)
- `subscribed_modules` TEXT[]
- `is_demo` BOOLEAN (demo sandboxes)
- `subscription_status` TEXT (inactive/active/suspended/cancelled) — `trial_ends_at` retained for legacy rows only
- `suspended_at` TIMESTAMPTZ
- `suspension_months` INTEGER

**profiles** (extends Supabase auth.users)
- `id` UUID REFERENCES auth.users
- `display_name` TEXT
- `email` TEXT
- `phone` TEXT
- `preferred_language` TEXT

**organization_members**
- `id` UUID PRIMARY KEY
- `organization_id` UUID
- `user_id` UUID
- `roles` TEXT[] (admin/member/mentor/volunteer)
- `status` TEXT (active/inactive/pending)
- UNIQUE(organization_id, user_id)

### PEOPLE module

**members** (org-specific member data)
- `id` UUID PRIMARY KEY
- `organization_id` UUID
- `user_id` UUID
- Member details: `member_number`, `date_of_birth`, `gender`, `marital_status`
- Contact: `address`, `emergency_contact_*`
- Church info: `baptism_date`, `membership_date`, `member_status`

**donations**
- `id` UUID PRIMARY KEY
- `organization_id` UUID
- `member_id` UUID
- `amount` DECIMAL(10,2)
- `currency` TEXT (MYR)
- `donation_type` TEXT (tithe/offering/building_fund/missions)
- `payment_method` TEXT
- `transaction_date` DATE

**events**
- `id` UUID PRIMARY KEY
- `organization_id` UUID
- `title`, `description`, `event_type`
- `start_at`, `end_at`, `location`
- `max_capacity`, `registration_required`

**event_registrations**
- Links events to members, tracks check-in status

**groups** (cell groups, ministries, committees)
- `id` UUID PRIMARY KEY
- `organization_id` UUID
- `name`, `group_type`, `description`
- `leader_id` UUID
- `meeting_day`, `meeting_time`, `meeting_location`
- `status` (active/inactive/multiplying)

**group_members**, **group_attendance** track membership and weekly attendance

### JOURNEY module

**tracks**, **modules**, **lessons** with bilingual content (en/zh)
- Each track can have `prerequisite_track_id` for enrollment gating

**enrollments**
- `id` UUID PRIMARY KEY
- `organization_id` UUID
- `track_id` UUID
- `mentee_id` UUID
- `mentor_id` UUID
- `status` (active/completed/dropped)

**lesson_progress** tracks completion states and mentor reviews

**certificates**
- `id` UUID PRIMARY KEY
- `organization_id` UUID
- `user_id` UUID
- `track_id` UUID
- `certificate_number` TEXT UNIQUE
- `issued_at`, `revoked`, `revoked_reason`
- **Cross-org visible**: users can see own certificates; admins can see certificates of members in their org

### PAGES module

**pages** with multilingual content slots
- `slug` TEXT
- `title_en`, `title_zh`, `title_ms`, `title_ta`
- `content_en`, `content_zh`, `content_ms`, `content_ta` (Tiptap JSON)
- Background customization fields: `background_type` (solid/gradient/image/none), `background_solid_color`, `background_gradient` (JSONB), `background_image_url`, `background_image_settings` (JSONB)
- `published` BOOLEAN

**page_blocks** for block-based content
- `type` TEXT (richtext/hero/questions/contact_form/video/image_gallery/sermon_list/custom_html)
- `content_en`, `content_zh`, `content_ms`, `content_ta` (JSONB)
- `custom_html` TEXT (with Tailwind classes)
- `custom_css` TEXT (scoped to block)
- Same background fields as pages

**website_settings**
- `template_id` TEXT (modern-minimal/warm-community/next-generation)
- `primary_color` TEXT
- `logo_url`, `favicon_url`
- Contact info (email, phone, address)
- `custom_css` TEXT
- `custom_tailwind_config` JSONB

**social_media_links** (flexible, one-to-many)
- `platform` TEXT (facebook/instagram/youtube/twitter/tiktok/linkedin/whatsapp/telegram/spotify/apple_podcasts/custom)
- `handle` TEXT
- `url` TEXT (auto-generated from platform pattern)
- `position` INTEGER

### Plugin system tables

**plugins** (global registry)
- `slug`, `name`, `description`, `category`, `required_modules`, `pricing_tier`, `version`, `status`

**organization_plugins** (per-org installations)
- `enabled` BOOLEAN
- `config` JSONB
- `installed_at` TIMESTAMPTZ

### Billing tables

**subscriptions** (Stripe integration)
- `stripe_customer_id`, `stripe_subscription_id`
- `tier`, `billing_cycle`, `modules`, `amount`
- `status` (active/past_due/canceled/unpaid)
- `current_period_start/end`

**payment_history**
- `stripe_payment_intent_id`
- `amount`, `currency`, `status`, `payment_method`

---

## Row Level Security (RLS) patterns

### Current organization context

```sql
CREATE FUNCTION public.current_org_id()
RETURNS UUID AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::json->>'organization_id',
    current_setting('app.current_org_id', true)
  )::UUID;
$$ LANGUAGE SQL STABLE;
```

### Standard org-isolation policy

```sql
CREATE POLICY {table}_policy ON {table}
FOR {operation}
USING (
  organization_id = current_org_id()
  AND EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = current_org_id()
      AND user_id = auth.uid()
      AND status = 'active'
  )
);
```

### Role-based write policy

```sql
-- Admins only
CREATE POLICY {table}_admin_policy ON {table}
FOR INSERT
WITH CHECK (
  organization_id = current_org_id()
  AND 'admin' = ANY(
    (SELECT roles FROM organization_members
     WHERE organization_id = current_org_id()
       AND user_id = auth.uid()
       AND status = 'active')
  )
);
```

### Cross-org certificates policy

```sql
-- Users can see own certificates; org admins can see certificates of members in their org
CREATE POLICY certificates_cross_org ON certificates
FOR SELECT
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = current_org_id()
      AND 'admin' = ANY(om.roles)
      AND EXISTS (
        SELECT 1 FROM organization_members target
        WHERE target.user_id = certificates.user_id
          AND target.organization_id = current_org_id()
      )
  )
);
```

---

## Authentication & session management

### Session middleware (`server/middleware/01.session.ts`)

1. Extract `__session` httpOnly cookie
2. Verify JWT with Supabase
3. Load user's organization memberships (with roles, status)
4. Attach to `event.context.user`

### Org context middleware (`server/middleware/02.org-context.ts`)

1. Determine current org from:
   - Subdomain: `firstchurch.churchos.my`
   - Custom domain: `firstchurch.my`
   - X-Organization-ID header (API calls)
2. Verify user is active member of that org
3. Load org details (subscription, subscribed_modules)
4. Attach to `event.context.org`

### Authorization helpers (`server/utils/auth.ts`)

- `requireAuth(event)` → 401 if no session
- `requireOrg(event)` → 400 if no org context
- `requireRole(event, role)` → 403 if user lacks role
- `requireModule(event, module)` → 402/403 if module not in subscription

### Organization switching

- User with multiple orgs → dropdown in header (like GitHub/Supabase)
- Switch → redirect to `{orgSlug}.churchos.my`
- Server detects subdomain → loads new org context

---

## Module subscriptions & gating

### Pricing (post-20% monthly discount, 30% annual discount)

**PEOPLE Module (per month):**
- Starter: RM 79 (up to 100 members)
- Growth: RM 159 (up to 300 members)
- Pro: RM 319 (unlimited)

**JOURNEY Module (per month):**
- Starter: RM 119 (3 tracks, 50 enrollments)
- Growth: RM 239 (10 tracks, 200 enrollments)
- Pro: RM 479 (unlimited)

**PAGES Module:**
- Flat: RM 79/month (EN/ZH)
- Pro adds Malay + Tamil

**All-in-One Bundle (15% discount):**
- Starter: RM 236/mo or RM 1,982/year
- Growth: RM 474/mo or RM 3,979/year
- Pro: RM 746/mo or RM 6,263/year
- **Includes: Free custom domain (1 year) + all languages**

### Workspace lifecycle

1. **Register (self-serve):** Account created, church workspace provisioned with status `inactive` — no automatic trial
2. **Activation (owner-arranged):** Workspace moves to `active` when a plan is agreed; `subscribed_modules` unlocks the bought modules
3. **Suspended:** Payment/reactivation issue; read-only access
4. **Cancelled:** Data retained 30 days, then archived

### Demo sandbox (prospect exploration)

There is no free trial. Prospective churches explore through a **public demo sandbox** at `app.churchos.my/auth/demo`:

- A shared demo auth account with public credentials shown on the demo page
- Every visitor who enters gets a **fresh, isolated sandbox org** (`is_demo = true`) pre-seeded with sample members, tracks, enrollments, and pages
- Sandboxes are fully editable (all modules, all roles) but can never create a new organization
- A demo banner offers an in-app role switcher (admin/member/mentor/volunteer) so prospects can preview each view without logging out
- Signing out deletes the sandbox and everything changed inside it; abandoned sandboxes are swept after 24h

Demo orgs are `is_demo = true`, always `active`, subscribed to every module, and invisible to billing.

### Backend gating

Every module API endpoint calls `requireModule(event, 'module-name')` before processing. Demo sandboxes pass all module gates; inactive workspaces are blocked until activated.

---

## Domain management

### Subdomain provisioning (automatic on signup)

1. User signs up, chooses slug (e.g., "firstchurch")
2. Validate slug format: `^[a-z0-9-]{3,30}$`, check reserved words
3. Check availability in `organizations.slug`
4. Create organization record with status `inactive`
5. Cloudflare API: Create CNAME `firstchurch.churchos.my → churchos.my` (proxied, → Pages)
6. User redirected to subdomain

### Custom domain flow

**Option A: All-in-One plan (free domain)**
1. User requests `firstchurch.my`
2. Check availability via Cloudflare Registrar API
3. Free if All-in-One plan, otherwise market price
4. Register domain, add to Cloudflare
5. Update `organizations.custom_domain`
6. DNS propagates 24-48h, then verified

**Option B: Bring-your-own domain**
1. User owns `firstchurch.my`
2. Generate verification token
3. Instructions: Add TXT record + CNAME
4. Background job checks DNS, marks verified when both present

### Multi-tenancy routing

Middleware resolves org from:
1. Custom domain match (highest priority)
2. Subdomain match
3. X-Organization-ID header (API only)

---

## JOURNEY credential portability

### Certificate visibility (cross-org)

When admin enrolls a member in a track with prerequisites:

1. Fetch mentee's certificate history (all orgs, not revoked)
2. Display certificates with issuing org name
3. Admin sees: "User has 'Foundation Track' cert from First Church KL"
4. If prerequisite satisfied → enable track
5. If missing → mark track as unavailable

### Enrollment with prerequisites

```typescript
// server/api/journey/enrollments/index.post.ts
// 1. Load track (check prerequisite_track_id)
// 2. Get mentee's user_id
// 3. Query certificates for (user_id, prerequisite_track_id, revoked=false)
// 4. If missing → 400 error
// 5. If satisfied → create enrollment
```

### Certificate schema

- `certificate_number` unique globally
- `issued_at`, `revoked`, `revoked_reason`
- Immutable `template_data` JSONB snapshot
- Cross-org query via `user_id` index

---

## PAGES module

### Template philosophy

**Avoid:** Traditional church website catalog (History, Vision, Schedule)
**Emphasize:** Questions seekers actually ask (I'm new, Going through tough times, What do you believe, Kids programs, How to serve)

### Available templates

1. **Modern Minimal** - Clean, spacious, question-based nav
2. **Warm Community** - Photo-heavy, story-driven
3. **Next Generation** - Bold, contemporary, mobile-first

### Default page structure (all templates)

- Home (hero + common questions)
- First Time Here? (what to expect)
- Going Through a Tough Time (care ministries)
- What We Believe (accessible theology)
- Kids & Students
- Find Your Place (volunteer pathways)
- Contact

### Page builder features

- **Block-based editing:** Tiptap rich text, hero, questions, contact form, video, gallery, sermon list, custom HTML
- **Multilingual tabs:** EN | ZH | MS (Pro) | TA (Pro)
- **Background customization:**
  - Solid color (color picker)
  - Gradient (linear/radial, multiple color stops, angle control)
  - Image upload (with size, position, repeat, parallax, overlay, blur controls)
- **Advanced blocks:**
  - Custom HTML + Tailwind classes (Monaco editor, live preview)
  - Custom CSS (scoped to block, sanitized)
- **Live preview:** Real-time render
- **SEO fields:** Meta title, description per language

### Social media management

**Flexible one-to-many structure:** churches add as many platforms as needed.

**Supported platforms (auto-icon pairing):**
- Facebook, Instagram, YouTube, Twitter/X, TikTok
- LinkedIn, WhatsApp, Telegram
- Spotify, Apple Podcasts
- Custom link (full URL)

**Flow:**
1. Select platform from dropdown
2. Enter handle (e.g., `firstchurchkl`)
3. System generates full URL using platform pattern
4. Platform icon auto-paired with Lucide icon
5. Display in website footer

### Security: Custom HTML/CSS sanitization

- `DOMPurify` for HTML (allow Tailwind, block scripts/iframes/event handlers)
- CSS validation (block `expression()`, `@import`, `javascript:`, etc.)
- Monaco editor with syntax highlighting
- Live preview in sandboxed iframe

---

## Billing & Stripe integration

### Checkout flow

1. User selects plan (tier + modules + billing cycle)
2. Platform creates Stripe Checkout session with metadata (org_id, tier, modules, billing_cycle)
3. Redirect to Stripe-hosted page (supports FPX, cards, e-wallets)
4. Stripe webhook → update `organizations.subscription_status = 'active'`
5. Create `subscriptions` and `payment_history` records
6. Send receipt email via Resend

### Webhook handler

Handles events:
- `checkout.session.completed` → activate subscription
- `invoice.payment_succeeded` → log payment, extend period
- `invoice.payment_failed` → mark past_due, notify
- `customer.subscription.deleted` → cancel

### Cron job (daily at 2 AM UTC)

1. Sweep abandoned demo sandboxes (>24h)
2. Check past_due subscriptions past grace period → suspend
3. Increment `suspension_months`
4. Send notification emails

### Reactivation fee

```
fee = suspension_months × RM 10
```

Calculated when org re-subscribes after suspension.

---

## Infrastructure & deployment

### VPS resource allocation (4 vCPU, 7.8GB RAM, 26GB free disk)

| Service | RAM | CPU |
| --- | --- | --- |
| PostgreSQL | 2GB | 2 vCPU |
| PostgREST | 512MB | 0.5 vCPU |
| Realtime | 512MB | 0.5 vCPU |
| Storage | 512MB | 0.5 vCPU |
| Studio | 256MB | 0.5 vCPU |
| Nginx | 128MB | 0.5 vCPU |
| **Total** | **~4GB** | **4 vCPU** |
| System buffer | ~3.8GB | - |

### Docker Compose stack

- `supabase/postgres:15.6.1.147`
- `postgrest/postgrest:v12.0.2`
- `supabase/realtime:v2.28.32`
- `supabase/storage-api:v1.0.6`
- `supabase/studio` (admin UI)
- `nginx:alpine` (reverse proxy + SSL)

### Deployment workflow

**Marketing site:** Push to `main` → CI → Cloudflare Pages (static)
**Platform app:** Push to `main` → CI (lint, typecheck, test, build) → Cloudflare Pages SSR
**Supabase migrations:** Manual via `supabase db push` (separate from app deploy)
**Cron triggers:** Cloudflare Workers Cron (daily subscription checks)

### CI/CD pipeline

```yaml
# .github/workflows/platform-deploy.yml
- Lint (ESLint)
- Typecheck (vue-tsc)
- Test (Vitest)
- Build (Nuxt production build)
- Deploy to Cloudflare Pages
```

### Backup strategy

- Daily PostgreSQL dump (cron at 3 AM)
- Compress with gzip, upload to S3/B2/Wasabi
- Retention: 30 days daily, 3 months weekly, 1 year monthly

### Monitoring

- **Uptime:** UptimeRobot (5-min checks)
- **Errors:** Sentry (free tier, 5k events/month)
- **Logs:** Cloudflare Workers logs + VPS syslog
- **Database:** Supabase Studio dashboard

---

## Plugin architecture (Phase 2+)

### Plugin SDK design

```typescript
interface ChurchOSPlugin {
  slug: string
  name: string
  version: string
  
  onInstall?(org, config): Promise<void>
  onUninstall?(org): Promise<void>
  onEnable?(org): Promise<void>
  onDisable?(org): Promise<void>
  
  routes?: {
    admin?: RouteDefinition[]
    public?: RouteDefinition[]
    api?: APIRouteDefinition[]
  }
  
  migrations?: Migration[]
  settings?: PluginSettingsSchema
  requiredModules?: string[]
  requiredRoles?: string[]
}
```

### Plugin marketplace

Churches browse and install plugins from marketplace UI. Plugins:
- Disabled by default
- Toggle on/off per organization
- Plugin-specific settings (JSONB config)
- Required modules/tier enforced before installation

### Example: Facial Recognition Attendance plugin

**How it works:**
1. Camera streams RTSP feed to platform
2. Face detection runs on frames (AWS Rekognition or local model)
3. Detected faces matched against member face embeddings
4. Match → auto-log attendance with timestamp
5. Real-time dashboard shows attendees
6. Privacy: members opt-in, embeddings encrypted, retention limits

**Settings:**
- Camera locations (name, RTSP URL, recognition threshold)
- Auto-create attendance (boolean)
- VIP notification (boolean)

**Future:** License plate recognition for parking (same pattern)

---

## Phase 2+ roadmap (plugins)

### Attendance & Access
1. **Facial Recognition Attendance** (Pro tier) - Auto-detect members entering sanctuary
2. **License Plate Recognition** (Pro tier) - Parking management, auto-log timestamps

### Communication
3. **SMS/WhatsApp Broadcast** (Free, usage-based) - Group messaging, templates
4. **Email Campaigns** (Free) - Drag-drop builder, segmentation, analytics
5. **Push Notifications** (Free) - PWA notifications, event reminders

### Media & Content
6. **Sermon Manager & Transcription** (Free) - Upload, auto-transcribe (Whisper), podcast RSS
7. **Live Streaming Integration** (Free) - YouTube/Facebook embeds, scheduling

### Finance
8. **Online Giving Gateway** (Paid: RM 49/mo + fees) - FPX, cards, e-wallets (TNG/GrabPay/Boost)
9. **Expense Tracking** (Free) - Log expenses, budgets, approvals

### Engagement
10. **Prayer Wall** (Free) - Submit requests, "praying for this" counter, praise reports
11. **Online Forms Builder** (Free) - Drag-drop, conditional logic, file uploads
12. **Small Group Finder** (Free) - Public directory, join requests

### Operations
13. **Volunteer Scheduler** (Free) - Rosters, availability, swap requests
14. **Room/Resource Booking** (Free) - Book rooms, equipment, vehicles
15. **Check-in Kiosk Mode** (Free) - Tablet self-check-in, name tags

### Intelligence
16. **AI Content Assistant** (Pro, API usage-based) - Multilingual content generation
17. **Advanced Reports** (Free) - Custom builder, trends, exports
18. **Predictive Insights** (Pro) - At-risk member identification

### Mobile
19. **Native Mobile App** (Free) - iOS/Android, offline access, push notifications

### Integrations
20. **Zapier/Make.com** (Free) - Connect to 3000+ apps
21. **Accounting Software Export** (Free) - SQL Account, AutoCount

---

## Implementation phases

### Phase 1: Foundation (Weeks 1-4)

**Goal:** Marketing site + Auth + Organization creation

**Tasks:**
1. Set up monorepo (pnpm workspaces)
2. Initialize `apps/marketing` (landing, pricing, features)
3. Initialize `apps/platform` (Nuxt 4)
4. Set up Docker Supabase stack
5. Create core migrations (organizations, profiles, organization_members)
6. Implement Supabase Auth (email/password, Google OAuth, mobile OTP)
7. Build signup flow with slug validation
8. Implement subdomain provisioning via Cloudflare API
9. Session middleware (01.session.ts)
10. Org context middleware (02.org-context.ts)
11. Authorization helpers (auth.ts)
12. Organization switcher composable
13. Basic dashboard (no modules yet, just org info)

### Phase 2: PEOPLE Module (Weeks 5-8)

**Goal:** Member management with basic CRUD

**Tasks:**
1. Members table migration + RLS
2. Members CRUD UI (list, view, create, edit)
3. Invitation system (email invites via Resend)
4. Member roles management (admin, member, volunteer)
5. Demo sandbox sweep (abandoned >24h)
6. Subscription status display
7. Module access checks (requireModule helper)

### Phase 3: JOURNEY Module (Weeks 9-14)

**Goal:** Discipleship LMS with cross-org certificates

**Tasks:**
1. Tracks/modules/lessons schema with bilingual content
2. Lesson player UI (from DOVES patterns)
3. Enrollments with mentor assignment
4. Lesson progress tracking
5. Quiz system (objective questions)
6. Mentor review workflow
7. Certificate generation with templates
8. Cross-org certificate visibility
9. Enrollment prerequisite checking

### Phase 4: PAGES Module (Weeks 15-18)

**Goal:** People-centric website builder

**Tasks:**
1. Pages schema with multilingual content
2. Page list + CRUD UI
3. Block-based editor (richtext, hero, questions, etc.)
4. Background customization (solid/gradient/image)
5. Custom HTML + CSS blocks (advanced users)
6. Social media links management
7. Website templates (3 starter templates)
8. Public website rendering (SSR)
9. Custom domain support (bring-your-own + free for All-in-One)

### Phase 5: Billing (Weeks 19-20)

**Goal:** Stripe integration with subscription management

**Tasks:**
1. Subscriptions + payment_history tables
2. Stripe Checkout integration
3. Webhook handler (checkout.session.completed, invoice events)
4. Pricing page UI
5. Billing dashboard (subscription status, invoices)
6. Cron job for subscription checks
7. Reactivation fee calculation
8. Email notifications (suspended, cancelled)

### Phase 6: Polish & Launch (Weeks 21-22)

**Goal:** Production-ready deployment

**Tasks:**
1. Backup automation (daily PostgreSQL dumps)
2. Monitoring setup (UptimeRobot, Sentry)
3. Security audit (RLS policies, RLS sanitization)
4. Performance testing (load testing with 50 churches)
5. Documentation (user guide, admin guide, API docs)
6. Marketing site content (features, pricing, testimonials)
7. Onboarding flow (interactive tutorial)
8. Beta testing with 3-5 churches

### Phase 7: Plugin System Foundation (Weeks 23-24)

**Goal:** Plugin SDK + marketplace UI

**Tasks:**
1. Plugins + organization_plugins tables
2. Plugin SDK package (`@churchos/plugin-sdk`)
3. Plugin marketplace UI (browse, install, configure)
4. Plugin registry + enable/disable toggle
5. Plugin settings schema validation
6. Example plugin (e.g., Prayer Wall) for testing

---

## Acceptance criteria

ChurchOS Phase 1 is ready when:

1. Church can register → receive subdomain → workspace inactive until activated (no trial)
2. Admin can invite members via email
3. Members can join JOURNEY track with mentor assignment
4. Mentor can review lessons, mentee can progress
5. Certificates issued on completion, visible across orgs
6. Admin can build website with templates, customize blocks
7. Subscription checkout works with Stripe, modules unlock after payment
8. Suspended accounts show reactivation fee on dashboard
9. All-in-One plan gets free domain provisioning
10. System handles 50+ churches on VPS without performance degradation
11. All RLS policies enforced (negative-access tests pass)
12. Daily backups automated, restore tested
13. CI/CD pipeline deploys on main branch
14. Plugin system can install/disable custom features
15. Documentation covers all user journeys

---

## Open questions

None - all clarifications resolved during brainstorming session (2026-08-24).

## References

- DOVES architecture: `C:\Users\Admin\Desktop\doves\docs\ARCHITECTURE.md`
- DOVES PRD: `C:\Users\Admin\Desktop\doves\docs\PRD.md`
- DOVES design system: `C:\Users\Admin\Desktop\doves\design-system\`
- Supabase RLS: https://supabase.com/docs/guides/auth/row-level-security
- Stripe subscriptions: https://stripe.com/docs/billing/subscriptions/overview
- Cloudflare Registrar API: https://developers.cloudflare.com/registrar/
