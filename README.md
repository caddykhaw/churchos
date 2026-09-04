# ChurchOS

Multi-tenant SaaS for Malaysian churches. Modular Church Management System (ChMS), Discipleship LMS, and People-centric website builder — all in one platform.

- **Live:** `churchos.my` · `app.churchos.my` · `db.churchos.my`
- **GitHub:** [caddykhaw/churchos](https://github.com/caddykhaw/churchos) · `main` branch
- **CI:** 41 tests passing ✅ · Lint + Typecheck + Build on every PR

---

## Architecture

```
Cloudflare Pages
├── churchos.my        → Marketing site (static, Nuxt 4)
├── www.churchos.my    → CNAME → churchos.my (Pages)
├── app.churchos.my    → CNAME → churchos-platform.pages.dev (platform SSR)
├── *.churchos.my      → CNAME → churchos.my (tenant subdomains)
├── db.churchos.my     → A → VPS :33001 (Supabase Studio, proxied)

VPS (4 vCPU, 7.8 GB RAM) — self-hosted Supabase stack only
├── PostgreSQL 15        (db service, host port 35432)
├── PostgREST             (rest service, host port 38080)
├── Supabase Studio       (studio, host port 33001)
└── Nginx                 (nginx, host port 8088, reverse proxy)
```

### Stack

| Layer | Technology |
|---|---|
| Application | Nuxt 4, Vue 3, TypeScript, Nitro (SSR) |
| Identity | Supabase Auth (email/password) + shared demo account for the sandbox |
| Database | PostgreSQL (self-hosted via Docker) |
| Realtime | Supabase Realtime |
| Storage | Supabase Storage |
| Hosting | Cloudflare Pages (platform + marketing) |
| DNS | Cloudflare API (auto-provisioned tenant subdomains) |
| Payments | Owner-activated plans (self-serve checkout not yet enabled) |
| Email | Resend |
| Package manager | pnpm workspaces (monorepo) |

### Multi-tenancy

- **Isolation:** every table (except global lookups) carries `organization_id`; RLS policies enforce row-level isolation
- **Context:** middleware resolves the current org from subdomain (`{slug}.churchos.my`), custom domain, or `X-Organization-ID` header
- **Authz:** server-side middleware (`01.session.ts`, `02.org-context.ts`) + helpers in `server/utils/auth.ts` (`requireAuth`, `requireOrg`, `requireRole`, `requireModule`)
- **Subscription gating:** `requireModule` blocks module APIs; frontend gates via `hasModule()` composable
- **Cross-org:** JOURNEY certificates are visible across orgs (users see own; admins see members' within their org)
- **Subdomain rules:** `{slug}.churchos.my`, `^[a-z0-9-]{3,30}$`, reserved words: `app, www, api, admin, docs, blog, mail`

### Modules

1. **PEOPLE** — ChMS (members, donations, events, groups, volunteers)
2. **JOURNEY** — Discipleship LMS (tracks, enrollments, mentors, certificates)
3. **PAGES** — People-centric church website builder (multilingual content, block editor)

Users can belong to multiple orgs and switch via a dropdown (header). JOURNEY certificates carry across organizations.

### Pricing (MYR, post-discount)

| Module | Starter | Growth | Pro |
|---|---|---|---|
| PEOPLE | RM 79 (≤100 members) | RM 159 (≤300) | RM 319 (unlimited) |
| JOURNEY | RM 119 (3 tracks) | RM 239 (10 tracks) | RM 479 (unlimited) |
| PAGES | RM 79/mo (EN/ZH) | — | RM 79/mo + MS/TA |
| **All-in-One** | RM 236/mo | RM 474/mo | RM 746/mo |

All-in-One includes a free custom domain (1 year) and all languages. Workspaces are **activated when a plan is arranged** — there is no self-serve trial. Prospective churches can try the full product in the **public demo sandbox** (`app.churchos.my/auth/demo`): every visitor gets an isolated, pre-seeded workspace with all modules enabled, and the copy is deleted when they sign out.

**Workspace lifecycle:** `inactive` (registered, waiting to be activated) → `active` → `suspended` / `cancelled`. Demo sandboxes are flagged `is_demo = true` and are never part of billing.

---

## Project structure

```
churchos/
├── .github/workflows/
│   ├── ci.yml                  # Lint, typecheck, test, build on PR/push
│   └── platform-deploy.yml     # Deploy platform → Cloudflare Pages
├── apps/
│   ├── marketing/              # ChurchOS.my (lightweight, static landing)
│   └── platform/               # Main SaaS (PEOPLE + JOURNEY + PAGES)
├── packages/
│   ├── database/               # Supabase client factory + shared TS types
│   ├── ui/                     # DOVES design-system Vue components
│   ├── i18n/                   # EN/ZH/MS/TA translations
│   ├── plugin-sdk/             # Plugin development kit
│   └── utils/                  # Shared utilities
├── supabase/
│   └── migrations/             # Schema + RLS migrations
├── docker/
│   ├── docker-compose.yml      # Local self-hosted Supabase stack
│   ├── nginx.conf              # Reverse proxy
│   └── .env.example            # Docker secrets template
├── docs/superpowers/
│   ├── specs/                  # Design specifications
│   └── plans/                  # Implementation plans
└── wrangler.toml               # Cloudflare Pages config
```

---

## Requirements

- Node `>=24.11.0 <25`
- pnpm `11.19.0`
- Docker (for the local Supabase stack)
- Cloudflare account with the `churchos.my` zone configured for Pages
- (CI/CD) GitHub secrets — see [Deployment](#deployment)

---

## Local development

```bash
# 1. Use the pinned Node version
nvm use 24        # or: fnm use 24

# 2. Install dependencies
pnpm install

# 3. Configure environment
cp .env.example .env
# Edit .env with your local keys (see .env.example comments)
# Local Supabase REST runs on http://localhost:38080

# 4. Start the local Supabase stack
docker compose -f docker/docker-compose.yml up -d

# 5. Run both apps (ports: platform :3008, marketing :3000)
pnpm dev
```

### Local services & ports

| Service | Host port | Container |
|---|---|---|
| PostgreSQL | 35432 | 5432 |
| PostgREST | 38080 | 3000 |
| Studio | 33001 | 3000 |
| Nginx | 8088 | 80 |
| Platform dev | 3008 | — |
| Marketing dev | 3000 | — |

> Ports are shifted from the original plan to avoid collisions with other services on this host. Update `NUXT_PUBLIC_SUPABASE_URL` in `.env` to `http://localhost:38080` to match.

### Useful commands

```bash
pnpm dev          # Start marketing + platform dev servers
pnpm build          # Build all apps
pnpm test           # Run all tests
pnpm lint && pnpm typecheck
pnpm --filter platform dev     # Platform only
pnpm --filter marketing dev    # Marketing only
```

### Docker secrets

Generate strong secrets and save to `docker/.env` (never commit this file):

```bash
openssl rand -base64 32   # JWT_SECRET (32+)
openssl rand -base64 32   # POSTGRES_PASSWORD (32+)
# Get ANON_KEY + SERVICE_KEY from Supabase local studio → Settings → API
```

---

## Database

Migrations live in `supabase/migrations/` (chronological, prefixed). Apply locally with:

```bash
docker exec -i churchos-db psql -U postgres < supabase/migrations/20260824000001_initial_schema.sql
```

### Current migrations

| File | Description |
|---|---|
| `20260824000001_initial_schema.sql` | Core tables: `organizations`, `profiles`, `organization_members` + helpers (`current_org_id()`, `update_updated_at()`) |
| `20260824000002_rls_policies.sql` | RLS policies for org-isolation + role-based writes |
| `20260903000002_module_tables.sql` | Module tables: `members`, `tracks`, `enrollments`, `pages` |
| `20260903000003_demo_and_inactive.sql` | `organizations.is_demo` flag; default status `inactive`; migrate legacy `trial` rows |

---

## Deployment

### CI/CD (.github/workflows)

- **`ci.yml`** — runs on PR + push to `main`: lint, typecheck, test, build.
- **`platform-deploy.yml`** — on push to `main` (paths: `apps/platform/**`, `packages/**`, `supabase/**`):
  1. `supabase db push --linked` (applies migrations to remote)
  2. `pnpm --filter platform build` (Cloudflare Pages preset)
  3. Deploys `apps/platform/.output/public` → `churchos-platform` Pages project

### GitHub secrets required

| Secret | Purpose |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | Supabase CLI remote access |
| `SUPABASE_PROJECT_REF` | Remote project reference |
| `SUPABASE_URL` | Remote Supabase URL |
| `SUPABASE_ANON_KEY` | Public anon key |
| `SUPABASE_SERVICE_KEY` | Service role key (server-side only) |
| `CLOUDFLARE_API_TOKEN` | Pages deploy + DNS |
| `CLOUDFLARE_ZONE_ID` | `churchos.my` zone |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account |
| `CLOUDFLARE_PAGES_PROJECT` | `churchos-platform` |

### Marketing site

Deployed as a separate lightweight static site. The `wrangler.toml` configures `churchos-platform` Pages project with output dir `apps/platform/dist`.

---

## Testing

The platform app ships with Vitest + `@nuxt/test-utils`:

```bash
pnpm test          # all workspace tests
pnpm --filter platform test  # platform only
```

41 tests pass across the suite (auth, org context, module APIs, subscription gating, Cloudflare DNS helpers).

---

## Documentation

- [Multi-tenant design spec](docs/superpowers/specs/2026-08-24-churchos-multi-tenant-design.md)
- [Foundation infrastructure plan](docs/superpowers/plans/2026-08-24-foundation-infrastructure.md)
- [DOVES design system](packages/ui/)

---

## License

Proprietary — internal ChurchOS project. Authored by Caddy Khaw / NikkoHosting.
