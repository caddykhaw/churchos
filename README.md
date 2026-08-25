# ChurchOS

Multi-tenant SaaS for Malaysian churches. Modules: PEOPLE (ChMS), JOURNEY (LMS), PAGES (website builder).

## Stack

- Nuxt 4, Vue 3, TypeScript, Nitro
- Supabase (Postgres + Auth + Realtime + Storage) — self-hosted via Docker
- Cloudflare Pages (hosting) + Cloudflare DNS (tenant subdomains under `churchos.nikkohosting.com`)
- Stripe (billing), Resend (email)
- pnpm workspaces (monorepo)

## Requirements

- Node `>=24.11.0 <25`
- pnpm `11.19.0`
- Docker (for local Supabase)
- Cloudflare account with the `churchos.nikkohosting.com` zone (or wildcard parent zone)

## Setup

```bash
nvm use 24  # or fnm use 24
pnpm install
cp .env.example .env
# Edit .env with your Cloudflare / Supabase / Stripe / Resend keys
docker compose -f docker/docker-compose.yml up -d
pnpm dev
```

## Project structure

```
apps/
├── marketing/    # ChurchOS.my marketing site (lightweight, static)
└── platform/     # Main SaaS (PEOPLE + JOURNEY + PAGES)
packages/
├── database/     # Supabase client, RLS helpers, types
├── ui/           # Shared Vue components (DOVES design system)
├── i18n/         # EN/ZH/MS/TA translations
├── plugin-sdk/   # Plugin development kit
└── utils/        # Shared utilities
supabase/
├── migrations/   # Schema migrations
└── seed.sql      # Demo data
docker/
├── docker-compose.yml  # Self-hosted Supabase stack
└── nginx.conf         # Reverse proxy
docs/
└── superpowers/
    ├── specs/    # Design specs
    └── plans/    # Implementation plans
```

## Status

This is the Foundation phase. See `docs/superpowers/plans/2026-08-24-foundation-infrastructure.md` for the 15-task implementation plan.

## License

Proprietary — internal ChurchOS project.
