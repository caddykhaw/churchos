# ChurchOS

Multi-tenant SaaS for Malaysian churches. Modular Church Management System (ChMS), Discipleship LMS, and People-centric website builder — all in one platform.

- **Live:** `churchos.my` · `app.churchos.my`
- **GitHub:** [caddykhaw/churchos](https://github.com/caddykhaw/churchos) · `main` branch
- **CI:** Lint + Typecheck + Tests + Build on every PR

---

## Architecture

```
Cloudflare Pages
├── churchos.my        → Marketing site (static, Nuxt 4)
├── www.churchos.my    → CNAME → churchos.my (Pages)
├── app.churchos.my    → CNAME → churchos-platform.pages.dev (platform SSR)
└── *.churchos.my      → CNAME → churchos.my (tenant subdomains)

Managed services
├── Turso (libSQL)     → primary database (libsql://churchos-....turso.io)
└── Clerk              → authentication (email/password + social, OTP-capable)
```

### Stack

| Layer | Technology |
|---|---|
| Application | Nuxt 4, Vue 3, TypeScript, Nitro (SSR) |
| Identity | Clerk (`@clerk/nuxt`) — sign-in/up components + Backend API |
| Sessions | First-party HMAC-signed cookies (`__session`), 7-day TTL |
| Database | Turso (libSQL/SQLite) via `@libsql/client` |
| Hosting | Cloudflare Pages (platform + marketing) |
| DNS | Cloudflare API (auto-provisioned tenant subdomains) |
| Payments | Owner-activated plans (self-serve checkout not yet enabled) |
| Email | Resend |
| Package manager | pnpm workspaces (monorepo) |

> **Migration note (2026-09):** ChurchOS moved off self-hosted Supabase (Docker on a VPS) to Turso + Clerk. The public Postgres port, GoTrue auth service, and manual backup burden are gone; tenant isolation is enforced server-side (scoped SQL + org-context middleware) instead of Postgres RLS.

### Multi-tenancy

- **Isolation:** every table (except global lookups) carries `organization_id`; all queries are scoped by the org-context middleware and API helpers
- **Context:** middleware resolves the current org from subdomain (`{slug}.churchos.my`), custom domain, or `X-Organization-ID` header — membership is always verified server-side
- **Authz:** server-side middleware (`01.session.ts`, `02.org-context.ts`) + helpers in `server/utils/auth.ts` (`requireAuth`, `requireOrg`, `requireRole`, `requireModule`)
- **Subscription gating:** `requireModule` blocks module APIs; frontend gates via `hasModule()` composable
- **Subdomain rules:** `{slug}.churchos.my`, `^[a-z0-9-]{3,30}$`, reserved words: `app, www, api, admin, docs, blog, mail`

### Modules

1. **PEOPLE** — ChMS (members)
2. **JOURNEY** — Discipleship LMS (tracks, enrollments, mentors)
3. **PAGES** — People-centric church website builder (multilingual content)

Users can belong to multiple orgs and switch via a dropdown (header).

### Pricing (MYR, post-discount)

| Module | Starter | Growth | Pro |
|---|---|---|---|
| PEOPLE | RM 79 (≤100 members) | RM 159 (≤300) | RM 319 (unlimited) |
| JOURNEY | RM 119 (3 tracks) | RM 239 (10 tracks) | RM 479 (unlimited) |
| PAGES | RM 79/mo (EN/ZH) | — | RM 79/mo + MS/TA |
| **All-in-One** | RM 236/mo | RM 474/mo | RM 746/mo |

Workspaces are **activated when a plan is arranged** — there is no self-serve trial. Prospective churches can try the full product in the **public demo sandbox** (`app.churchos.my/auth/demo`): every visitor gets an isolated, pre-seeded workspace with all modules enabled, and the copy is deleted when they sign out.

**Workspace lifecycle:** `inactive` (registered, waiting to be activated) → `active` → `suspended` / `cancelled`. Demo sandboxes are flagged `is_demo = 1` and are never part of billing.

---

## Project structure

```
churchos/
├── .github/workflows/
│   ├── ci.yml                  # Lint, typecheck, test, build on PR/push
│   └── platform-deploy.yml     # Migrate + deploy platform → Cloudflare Pages
├── apps/
│   ├── marketing/              # ChurchOS.my (lightweight, static landing)
│   └── platform/               # Main SaaS (PEOPLE + JOURNEY + PAGES)
├── packages/
│   └── database/               # libSQL client factory + shared TS types
├── migrations/                 # SQLite/libSQL schema migrations
├── scripts/
│   └── migrate.mjs             # Migration runner (Turso HTTP API)
└── docs/superpowers/           # Specs, plans, audits
```

---

## Requirements

- Node `>=24.11.0 <25`
- pnpm `11.19.0`
- A Turso database (`turso db create churchos`)
- A Clerk application (`clerk init --framework nuxt`)

---

## Local development

```bash
# 1. Use the pinned Node version
nvm use 24        # or: fnm use 24

# 2. Install dependencies
pnpm install

# 3. Configure environment
cp .env.example apps/platform/.env
# Fill in TURSO_DATABASE_URL, TURSO_AUTH_TOKEN, Clerk keys, JWT_SECRET
# (or run `clerk env pull` inside apps/platform for the Clerk keys)

# 4. Apply migrations to Turso
pnpm --filter platform db:migrate

# 5. Run both apps (ports: platform :3008, marketing :3000)
pnpm dev
```

### Useful commands

```bash
pnpm dev                        # Start marketing + platform dev servers
pnpm build                      # Build all apps
pnpm test                       # Run all tests
pnpm lint && pnpm typecheck
pnpm --filter platform db:migrate   # Apply pending migrations to Turso
turso db shell churchos         # Inspect the database
```

---

## Database

Migrations live in `migrations/` (chronological, prefixed). They are plain SQLite SQL, applied over Turso's HTTP API — **no database port is ever exposed to the internet**. The runner tracks applied files in `schema_migrations`, so it is safe to re-run.

```bash
node scripts/migrate.mjs   # requires TURSO_DATABASE_URL + TURSO_AUTH_TOKEN
```

### Current migrations

| File | Description |
|---|---|
| `0001_init.sql` | Full schema: `organizations`, `profiles`, `organization_members`, `members`, `tracks`, `enrollments`, `pages` + CHECK constraints and indexes |

Conventions:
- UUIDs are TEXT primary keys generated app-side (`crypto.randomUUID()`)
- Booleans are stored as `0/1`; array-like columns are JSON strings
- Status columns are guarded by `CHECK` constraints (DB-level enum integrity)
- `updated_at` is set explicitly in UPDATE statements (no triggers over HTTP)

---

## Deployment

### CI/CD (.github/workflows)

- **`ci.yml`** — runs on PR + push to `main`: lint, typecheck, test, build.
- **`platform-deploy.yml`** — on push to `main` (paths: `apps/platform/**`, `packages/**`, `migrations/**`):
  1. `node scripts/migrate.mjs` (applies pending migrations to Turso)
  2. `pnpm --filter platform build` (Cloudflare Pages preset)
  3. Deploys `apps/platform/dist` → `churchos-platform` Pages project

### GitHub secrets required

| Secret | Purpose |
|---|---|
| `TURSO_DATABASE_URL` | libSQL URL (`libsql://...`) |
| `TURSO_AUTH_TOKEN` | Turso database token |
| `CLERK_PUBLISHABLE_KEY` | `pk_test_...` / `pk_live_...` |
| `CLERK_SECRET_KEY` | Clerk Backend API key (server-side only) |
| `JWT_SECRET` | Session cookie signing secret |
| `CLOUDFLARE_API_TOKEN` | Pages deploy + DNS |
| `CLOUDFLARE_ZONE_ID` | `churchos.my` zone |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account |

---

## Testing

The platform app ships with Vitest:

```bash
pnpm test          # all workspace tests
pnpm --filter platform test  # platform only
```

Tests cover auth, demo sandbox lifecycle, module CRUD (people/journey/pages), organization creation, rate limiting, and the schema tenant-isolation contract.

---

## Documentation

- [Multi-tenant design spec](docs/superpowers/specs/2026-08-24-churchos-multi-tenant-design.md)
- [Foundation infrastructure plan](docs/superpowers/plans/2026-08-24-foundation-infrastructure.md)

---

## License

Proprietary — internal ChurchOS project. Authored by Caddy Khaw / NikkoHosting.
