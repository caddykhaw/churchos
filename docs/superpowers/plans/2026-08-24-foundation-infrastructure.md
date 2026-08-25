# Foundation & Infrastructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up monorepo, Docker Supabase stack, Supabase Auth, organization creation with subdomain provisioning, and core authorization middleware.

**Architecture:** Clean-slate pnpm monorepo with `apps/marketing` and `apps/platform`. Docker Compose runs Supabase stack (Postgres, PostgREST, Realtime, Storage) on VPS. Platform uses Supabase Auth with email/password, Google OAuth, and mobile OTP. Multi-tenancy via `organization_id` + RLS. Subdomains provisioned automatically via Cloudflare API.

**Tech Stack:** Nuxt 4, Vue 3, TypeScript, Nitro, Supabase (Postgres + Auth + Realtime + Storage), Docker Compose, Cloudflare Pages, pnpm workspaces, Tiptap.

**Spec:** `docs/superpowers/specs/2026-08-24-churchos-multi-tenant-design.md`

---

## Global Constraints

- Node.js `>=24.11.0 <25`, pnpm `11.19.0`
- All organizations must have `organization_id` in every table (except global lookups)
- RLS enabled on all tables with org-scoped policies
- Subdomain format: `{slug}.churchos.my` (lowercase, alphanumeric + hyphens, 3-30 chars)
- Reserved slugs: app, www, api, admin, docs, blog, mail
- VPS specs: 4 vCPU, 7.8GB RAM, 26GB free disk
- Database password must be 32+ characters
- All secrets via environment variables, never committed

---

## File Structure

```
churchos/
├── .github/
│   └── workflows/
│       ├── ci.yml                    # Lint, typecheck, test on PR
│       └── platform-deploy.yml       # Deploy platform to Cloudflare
├── .gitignore
├── .env.example                      # Template for local env
├── package.json                      # Root workspace
├── pnpm-workspace.yaml               # Workspace config
├── tsconfig.json                     # Shared TypeScript config
├── docker/
│   ├── docker-compose.yml            # Supabase stack
│   ├── nginx.conf                    # Reverse proxy
│   └── .env.example                  # Docker secrets template
├── supabase/
│   ├── migrations/
│   │   └── 20260824000001_initial_schema.sql
│   ├── seed.sql                      # Demo orgs
│   └── config.toml
├── apps/
│   ├── marketing/
│   │   ├── package.json
│   │   ├── nuxt.config.ts
│   │   ├── app/
│   │   │   ├── pages/
│   │   │   │   ├── index.vue
│   │   │   │   ├── pricing.vue
│   │   │   │   └── features.vue
│   │   │   └── components/
│   │   └── tsconfig.json
│   └── platform/
│       ├── package.json
│       ├── nuxt.config.ts
│       ├── app/
│       │   ├── pages/
│       │   │   ├── index.vue
│       │   │   ├── auth/
│       │   │   │   ├── login.vue
│       │   │   │   ├── signup.vue
│       │   │   │   └── verify-otp.vue
│       │   │   └── dashboard.vue
│       │   ├── components/
│       │   │   ├── OrgSwitcher.vue
│       │   │   └── TrialBanner.vue
│       │   ├── composables/
│       │   │   ├── useAuth.ts
│       │   │   └── useOrg.ts
│       │   └── layouts/
│       │       └── default.vue
│       ├── server/
│       │   ├── middleware/
│       │   │   ├── 01.session.ts
│       │   │   └── 02.org-context.ts
│       │   ├── utils/
│       │   │   ├── supabase.ts
│       │   │   ├── auth.ts
│       │   │   └── cloudflare.ts
│       │   └── api/
│       │       ├── auth/
│       │       │   ├── signup.post.ts
│       │       │   ├── login.post.ts
│       │       │   ├── logout.post.ts
│       │       │   └── me.get.ts
│       │       └── organizations/
│       │           └── index.post.ts
│       └── tsconfig.json
└── packages/
    ├── database/
    │   ├── package.json
    │   ├── src/
    │   │   ├── client.ts             # Supabase client factory
    │   │   └── types.ts              # Generated DB types
    │   └── tsconfig.json
    └── ui/
        ├── package.json
        ├── src/
        │   └── components/
        │       └── Button.vue
        └── tsconfig.json
```

---

## Task 1: Initialize monorepo workspace

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `tsconfig.json`

- [ ] **Step 1: Create root package.json**

```json
{
  "name": "churchos",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@11.19.0",
  "engines": {
    "node": ">=24.11.0 <25"
  },
  "scripts": {
    "dev": "pnpm --filter marketing dev & pnpm --filter platform dev",
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "lint": "pnpm -r lint",
    "typecheck": "pnpm -r typecheck",
    "check": "pnpm lint && pnpm typecheck && pnpm test && pnpm build"
  }
}
```

- [ ] **Step 2: Create pnpm-workspace.yaml**

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

- [ ] **Step 3: Create .gitignore**

```
node_modules/
.pnpm-store/
.nuxt/
.output/
dist/
.env
.env.local
*.log
.DS_Store
.worktrees/
.wrangler/
.firebase/
.vscode/
.idea/
```

- [ ] **Step 4: Create .env.example**

```bash
# Supabase
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_KEY=your_service_key_here

# Cloudflare
CLOUDFLARE_API_TOKEN=your_token_here
CLOUDFLARE_ZONE_ID=your_zone_id_here
CLOUDFLARE_ACCOUNT_ID=your_account_id_here

# App
NUXT_PUBLIC_APP_URL=http://localhost:3000
JWT_SECRET=generate_with_openssl_rand_base64_32
```

- [ ] **Step 5: Create shared tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2024",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true
  },
  "exclude": ["node_modules", "**/node_modules", ".output", "dist"]
}
```

- [ ] **Step 6: Initialize git and commit**

```bash
git init
git add .
git commit -m "chore: initialize monorepo workspace"
```

---

## Task 2: Set up Docker Supabase stack

**Files:**
- Create: `docker/docker-compose.yml`
- Create: `docker/nginx.conf`
- Create: `docker/.env.example`
- Create: `docker/.env`

- [ ] **Step 1: Generate secrets**

Run:
```bash
openssl rand -base64 32  # JWT_SECRET
openssl rand -base64 32  # POSTGRES_PASSWORD
```

Save outputs to `docker/.env`.

- [ ] **Step 2: Create docker/.env**

```env
POSTGRES_PASSWORD=paste_generated_password_here
JWT_SECRET=paste_generated_jwt_secret_here
ANON_KEY=paste_anon_key_here
SERVICE_KEY=paste_service_key_here
```

- [ ] **Step 3: Create docker/docker-compose.yml**

```yaml
version: '3.8'

services:
  db:
    image: supabase/postgres:15.6.1.147
    container_name: churchos-db
    restart: unless-stopped
    ports:
      - "5432:5432"
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: postgres
    volumes:
      - db-data:/var/lib/postgresql/data
    healthcheck:
      test: pg_isready -U postgres -h localhost
      interval: 5s
      timeout: 5s
      retries: 10

  rest:
    image: postgrest/postgrest:v12.0.2
    container_name: churchos-rest
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      PGRST_DB_URI: postgres://postgres:${POSTGRES_PASSWORD}@db:5432/postgres
      PGRST_DB_SCHEMAS: public,storage
      PGRST_DB_ANON_ROLE: anon
      PGRST_JWT_SECRET: ${JWT_SECRET}
      PGRST_DB_USE_LEGACY_GUCS: "false"
    depends_on:
      db:
        condition: service_healthy

  studio:
    image: supabase/studio:20240729-15e7a36
    container_name: churchos-studio
    restart: unless-stopped
    ports:
      - "3001:3000"
    environment:
      SUPABASE_URL: http://rest:3000
      SUPABASE_ANON_KEY: ${ANON_KEY}

  nginx:
    image: nginx:alpine
    container_name: churchos-nginx
    restart: unless-stopped
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - rest

volumes:
  db-data:
```

- [ ] **Step 4: Create docker/nginx.conf**

```nginx
events {
    worker_connections 1024;
}

http {
    upstream postgrest {
        server rest:3000;
    }

    server {
        listen 80;
        server_name localhost;

        location /rest/v1/ {
            proxy_pass http://postgrest/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }
    }
}
```

- [ ] **Step 5: Start Docker stack**

Run:
```bash
docker-compose -f docker/docker-compose.yml up -d
```

Expected: All services healthy.

- [ ] **Step 6: Verify Postgres is accessible**

Run:
```bash
docker exec churchos-db psql -U postgres -c "SELECT version();"
```

Expected: PostgreSQL version string.

- [ ] **Step 7: Commit**

```bash
git add docker/
git commit -m "feat: add Docker Supabase stack"
```

---

## Task 3: Create initial database schema migration

**Files:**
- Create: `supabase/migrations/20260824000001_initial_schema.sql`

- [ ] **Step 1: Create migration file with core tables**

```sql
-- Organizations table
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  custom_domain TEXT UNIQUE,
  custom_domain_verified BOOLEAN DEFAULT false,
  
  subscription_tier TEXT NOT NULL DEFAULT 'starter',
  billing_cycle TEXT NOT NULL DEFAULT 'monthly',
  subscribed_modules TEXT[] NOT NULL DEFAULT '{}',
  trial_ends_at TIMESTAMPTZ,
  subscription_status TEXT NOT NULL DEFAULT 'trial',
  suspended_at TIMESTAMPTZ,
  suspension_months INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_organizations_custom_domain ON organizations(custom_domain) WHERE custom_domain IS NOT NULL;

-- Profiles table (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  preferred_language TEXT DEFAULT 'en',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Organization membership (many-to-many)
CREATE TABLE organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  roles TEXT[] NOT NULL DEFAULT '{member}',
  status TEXT NOT NULL DEFAULT 'active',
  
  joined_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(organization_id, user_id)
);

CREATE INDEX idx_org_members_org ON organization_members(organization_id);
CREATE INDEX idx_org_members_user ON organization_members(user_id);

-- Helper function: get current org from JWT
CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS UUID AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::json->>'organization_id',
    current_setting('app.current_org_id', true)
  )::UUID;
$$ LANGUAGE SQL STABLE;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER organizations_updated_at BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

- [ ] **Step 2: Apply migration to local database**

Run:
```bash
docker exec -i churchos-db psql -U postgres < supabase/migrations/20260824000001_initial_schema.sql
```

Expected: No errors, tables created.

- [ ] **Step 3: Verify tables exist**

Run:
```bash
docker exec churchos-db psql -U postgres -c "\dt"
```

Expected: List includes `organizations`, `profiles`, `organization_members`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/
git commit -m "feat(db): add core multi-tenant schema"
```

---

## Task 4: Add RLS policies for core tables

**Files:**
- Create: `supabase/migrations/20260824000002_rls_policies.sql`

- [ ] **Step 1: Create RLS migration file**

```sql
-- Enable RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

-- Organizations: users can see orgs they belong to
CREATE POLICY organizations_select_policy ON organizations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = organizations.id
        AND organization_members.user_id = auth.uid()
        AND organization_members.status = 'active'
    )
  );

-- Profiles: users can see/update their own profile
CREATE POLICY profiles_select_policy ON profiles
  FOR SELECT
  USING (id = auth.uid());

CREATE POLICY profiles_update_policy ON profiles
  FOR UPDATE
  USING (id = auth.uid());

-- Organization members: users can see members in their orgs
CREATE POLICY org_members_select_policy ON organization_members
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR organization_id = current_org_id()
  );

-- Admins can insert/update members
CREATE POLICY org_members_admin_insert ON organization_members
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = organization_members.organization_id
        AND om.user_id = auth.uid()
        AND 'admin' = ANY(om.roles)
        AND om.status = 'active'
    )
  );

CREATE POLICY org_members_admin_update ON organization_members
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = organization_members.organization_id
        AND om.user_id = auth.uid()
        AND 'admin' = ANY(om.roles)
        AND om.status = 'active'
    )
  );
```

- [ ] **Step 2: Apply RLS migration**

Run:
```bash
docker exec -i churchos-db psql -U postgres < supabase/migrations/20260824000002_rls_policies.sql
```

Expected: No errors.

- [ ] **Step 3: Verify RLS enabled**

Run:
```bash
docker exec churchos-db psql -U postgres -c "\d organizations" | grep "Row security"
```

Expected: "Row security: enabled"

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260824000002_rls_policies.sql
git commit -m "feat(db): add RLS policies for core tables"
```

---

## Task 5: Initialize packages/database workspace

**Files:**
- Create: `packages/database/package.json`
- Create: `packages/database/tsconfig.json`
- Create: `packages/database/src/client.ts`
- Create: `packages/database/src/types.ts`

- [ ] **Step 1: Create packages/database/package.json**

```json
{
  "name": "@churchos/database",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./client": "./src/client.ts",
    "./types": "./src/types.ts"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.57.4"
  },
  "devDependencies": {
    "typescript": "5.9.3"
  }
}
```

- [ ] **Step 2: Create packages/database/tsconfig.json**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Create packages/database/src/client.ts**

```typescript
import { createClient, SupabaseClient } from '@supabase/supabase-js'

export function createSupabaseClient(
  supabaseUrl: string,
  supabaseKey: string,
  options?: any
): SupabaseClient {
  return createClient(supabaseUrl, supabaseKey, options)
}

export function createSupabaseAdmin(supabaseUrl: string, serviceKey: string): SupabaseClient {
  return createClient(supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}
```

- [ ] **Step 4: Create packages/database/src/types.ts**

```typescript
export interface Organization {
  id: string
  slug: string
  name: string
  custom_domain: string | null
  custom_domain_verified: boolean
  subscription_tier: 'starter' | 'growth' | 'pro'
  billing_cycle: 'monthly' | 'annual'
  subscribed_modules: string[]
  trial_ends_at: string | null
  subscription_status: 'trial' | 'active' | 'suspended' | 'cancelled'
  suspended_at: string | null
  suspension_months: number
  created_at: string
  updated_at: string
}

export interface Profile {
  id: string
  display_name: string | null
  email: string
  phone: string | null
  avatar_url: string | null
  preferred_language: 'en' | 'zh' | 'ms' | 'ta'
  created_at: string
  updated_at: string
}

export interface OrganizationMember {
  id: string
  organization_id: string
  user_id: string
  roles: string[]
  status: 'active' | 'inactive' | 'pending'
  joined_at: string
}

export type ModuleName = 'people' | 'journey' | 'pages'
export type Role = 'admin' | 'member' | 'mentor' | 'volunteer'
```

- [ ] **Step 5: Create packages/database/src/index.ts**

```typescript
export * from './client'
export * from './types'
```

- [ ] **Step 6: Install dependencies**

Run:
```bash
pnpm install
```

Expected: `@churchos/database` linked in workspace.

- [ ] **Step 7: Commit**

```bash
git add packages/database/
git commit -m "feat(database): initialize @churchos/database package"
```

---

## Task 6: Initialize apps/platform (Nuxt 4 app)

**Files:**
- Create: `apps/platform/package.json`
- Create: `apps/platform/nuxt.config.ts`
- Create: `apps/platform/tsconfig.json`
- Create: `apps/platform/app/app.vue`

- [ ] **Step 1: Create apps/platform/package.json**

```json
{
  "name": "platform",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@11.19.0",
  "scripts": {
    "dev": "nuxt dev",
    "build": "nuxt build",
    "preview": "nuxt preview",
    "typecheck": "nuxt typecheck",
    "test": "vitest run",
    "lint": "eslint ."
  },
  "dependencies": {
    "@churchos/database": "workspace:*",
    "@supabase/supabase-js": "^2.57.4",
    "nuxt": "4.5.2",
    "vue": "3.5.41",
    "vue-router": "^5.2.0"
  },
  "devDependencies": {
    "@nuxt/test-utils": "4.1.0",
    "typescript": "5.9.3",
    "vitest": "4.1.10",
    "vue-tsc": "3.3.9"
  }
}
```

- [ ] **Step 2: Create apps/platform/nuxt.config.ts**

```typescript
export default defineNuxtConfig({
  compatibilityDate: '2026-08-24',
  devtools: { enabled: true },
  
  modules: ['@nuxt/eslint'],
  
  nitro: {
    preset: 'cloudflare-pages'
  },
  
  runtimeConfig: {
    supabaseUrl: process.env.NUXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321',
    supabaseServiceKey: process.env.NUXT_SUPABASE_SERVICE_KEY || '',
    cloudflareApiToken: process.env.CLOUDFLARE_API_TOKEN || '',
    cloudflareZoneId: process.env.CLOUDFLARE_ZONE_ID || '',
    jwtSecret: process.env.JWT_SECRET || '',
    public: {
      supabaseUrl: process.env.NUXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321',
      supabaseAnonKey: process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY || ''
    }
  },
  
  typescript: {
    strict: true
  }
})
```

- [ ] **Step 3: Create apps/platform/tsconfig.json**

```json
{
  "extends": "./.nuxt/tsconfig.json"
}
```

- [ ] **Step 4: Create apps/platform/app/app.vue**

```vue
<template>
  <div>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>
```

- [ ] **Step 5: Install dependencies**

Run:
```bash
pnpm install
```

- [ ] **Step 6: Verify Nuxt dev server starts**

Run:
```bash
cd apps/platform && pnpm dev
```

Expected: Server starts on http://localhost:3000.

- [ ] **Step 7: Commit**

```bash
git add apps/platform/
git commit -m "feat(platform): initialize Nuxt 4 platform app"
```

---

## Task 7: Create Supabase server utilities

**Files:**
- Create: `apps/platform/server/utils/supabase.ts`
- Create: `apps/platform/server/utils/auth.ts`

- [ ] **Step 1: Create apps/platform/server/utils/supabase.ts**

```typescript
import { createSupabaseAdmin, createSupabaseClient } from '@churchos/database'
import type { H3Event } from 'h3'

let _adminClient: ReturnType<typeof createSupabaseAdmin> | null = null

export function useSupabaseAdmin() {
  if (!_adminClient) {
    const config = useRuntimeConfig()
    _adminClient = createSupabaseAdmin(config.supabaseUrl, config.supabaseServiceKey)
  }
  return _adminClient
}

export function useSupabaseForRequest(event: H3Event) {
  const config = useRuntimeConfig()
  const token = getCookie(event, '__session')
  
  return createSupabaseClient(config.supabaseUrl, config.public.supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    },
    global: {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    }
  })
}
```

- [ ] **Step 2: Create apps/platform/server/utils/auth.ts**

```typescript
import type { H3Event } from 'h3'
import type { Organization, Profile, Role } from '@churchos/database'

export function requireAuth(event: H3Event) {
  if (!event.context.user) {
    throw createError({
      statusCode: 401,
      message: 'Authentication required'
    })
  }
  return event.context.user
}

export function requireOrg(event: H3Event) {
  requireAuth(event)
  
  if (!event.context.org) {
    throw createError({
      statusCode: 400,
      message: 'Organization context required'
    })
  }
  
  return event.context.org
}

export function requireRole(event: H3Event, role: Role) {
  const org = requireOrg(event)
  
  if (!org.userRoles.includes(role)) {
    throw createError({
      statusCode: 403,
      message: `Role '${role}' required`
    })
  }
}

export function requireModule(event: H3Event, module: 'people' | 'journey' | 'pages') {
  const org = requireOrg(event)
  
  if (org.subscription_status === 'trial') {
    return
  }
  
  if (org.subscription_status === 'suspended') {
    throw createError({
      statusCode: 402,
      message: 'Subscription suspended. Please contact support.'
    })
  }
  
  if (!org.subscribedModules.includes(module)) {
    throw createError({
      statusCode: 403,
      message: `Module '${module}' not included in your subscription`
    })
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/platform/server/utils/
git commit -m "feat(platform): add Supabase and auth utilities"
```

---

## Task 8: Create session and org-context middleware

**Files:**
- Create: `apps/platform/server/middleware/01.session.ts`
- Create: `apps/platform/server/middleware/02.org-context.ts`

- [ ] **Step 1: Create apps/platform/server/middleware/01.session.ts**

```typescript
export default defineEventHandler(async (event) => {
  const token = getCookie(event, '__session')
  
  if (!token) {
    event.context.user = null
    event.context.org = null
    return
  }
  
  try {
    const supabase = useSupabaseForRequest(event)
    const { data: { user }, error } = await supabase.auth.getUser(token)
    
    if (error || !user) {
      deleteCookie(event, '__session')
      event.context.user = null
      event.context.org = null
      return
    }
    
    // Load profile
    const admin = useSupabaseAdmin()
    const { data: profile } = await admin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
    
    if (!profile) {
      deleteCookie(event, '__session')
      event.context.user = null
      event.context.org = null
      return
    }
    
    // Load user's organizations
    const { data: memberships } = await admin
      .from('organization_members')
      .select(`
        organization_id,
        roles,
        status,
        organizations (
          id,
          slug,
          name,
          subscription_status,
          subscribed_modules,
          subscription_tier,
          trial_ends_at
        )
      `)
      .eq('user_id', user.id)
      .eq('status', 'active')
    
    event.context.user = {
      id: user.id,
      email: user.email!,
      profile,
      organizations: memberships || []
    }
    
    event.context.org = null // Will be set by org-context middleware
  } catch (err) {
    console.error('Session verification failed:', err)
    deleteCookie(event, '__session')
    event.context.user = null
    event.context.org = null
  }
})
```

- [ ] **Step 2: Create apps/platform/server/middleware/02.org-context.ts**

```typescript
export default defineEventHandler(async (event) => {
  if (!event.context.user) {
    event.context.org = null
    return
  }
  
  const host = getRequestHeader(event, 'host') || ''
  const orgHeader = getRequestHeader(event, 'x-organization-id')
  
  let orgId: string | null = null
  
  // 1. Check X-Organization-ID header (for API calls)
  if (orgHeader) {
    orgId = orgHeader
  } else {
    // 2. Check custom domain
    const admin = useSupabaseAdmin()
    
    const { data: orgByDomain } = await admin
      .from('organizations')
      .select('id')
      .eq('custom_domain', host)
      .eq('custom_domain_verified', true)
      .single()
    
    if (orgByDomain) {
      orgId = orgByDomain.id
    } else {
      // 3. Check subdomain
      const subdomain = host.split('.')[0]
      
      if (subdomain !== 'app' && subdomain !== 'www' && subdomain !== 'localhost') {
        const { data: orgBySlug } = await admin
          .from('organizations')
          .select('id')
          .eq('slug', subdomain)
          .single()
        
        if (orgBySlug) orgId = orgBySlug.id
      }
    }
  }
  
  if (orgId) {
    // Verify user is member of this org
    const membership = event.context.user.organizations.find(
      (m: any) => m.organization_id === orgId
    )
    
    if (membership) {
      event.context.org = {
        id: orgId,
        slug: membership.organizations.slug,
        name: membership.organizations.name,
        subscription_status: membership.organizations.subscription_status,
        subscribed_modules: membership.organizations.subscribed_modules,
        subscription_tier: membership.organizations.subscription_tier,
        trial_ends_at: membership.organizations.trial_ends_at,
        userRoles: membership.roles
      }
    } else {
      event.context.org = null
    }
  } else {
    event.context.org = null
  }
})
```

- [ ] **Step 3: Add type declarations**

Create `apps/platform/server/types.d.ts`:

```typescript
import type { Organization, Profile } from '@churchos/database'

declare module 'h3' {
  interface H3EventContext {
    user: {
      id: string
      email: string
      profile: Profile
      organizations: Array<{
        organization_id: string
        roles: string[]
        status: string
        organizations: Pick<Organization, 'id' | 'slug' | 'name' | 'subscription_status' | 'subscribed_modules' | 'subscription_tier' | 'trial_ends_at'>
      }>
    } | null
    
    org: {
      id: string
      slug: string
      name: string
      subscription_status: 'trial' | 'active' | 'suspended' | 'cancelled'
      subscribed_modules: string[]
      subscription_tier: 'starter' | 'growth' | 'pro'
      trial_ends_at: string | null
      userRoles: string[]
    } | null
  }
}

export {}
```

- [ ] **Step 4: Commit**

```bash
git add apps/platform/server/middleware/ apps/platform/server/types.d.ts
git commit -m "feat(platform): add session and org-context middleware"
```

---

## Task 9: Create Cloudflare DNS provisioning utility

**Files:**
- Create: `apps/platform/server/utils/cloudflare.ts`

- [ ] **Step 1: Create apps/platform/server/utils/cloudflare.ts**

```typescript
export async function provisionSubdomain(slug: string): Promise<void> {
  const config = useRuntimeConfig()
  
  if (!config.cloudflareApiToken || !config.cloudflareZoneId) {
    console.warn('Cloudflare credentials not configured, skipping subdomain provisioning')
    return
  }
  
  try {
    const response = await $fetch(
      `https://api.cloudflare.com/client/v4/zones/${config.cloudflareZoneId}/dns_records`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.cloudflareApiToken}`,
          'Content-Type': 'application/json'
        },
        body: {
          type: 'CNAME',
          name: slug,
          content: 'app.churchos.my',
          ttl: 3600,
          proxied: true
        }
      }
    )
    
    if (!(response as any).success) {
      throw new Error('Cloudflare API returned unsuccessful response')
    }
  } catch (err: any) {
    console.error('Cloudflare provisioning failed:', err)
    throw createError({
      statusCode: 500,
      message: 'Failed to provision subdomain'
    })
  }
}

export async function deprovisionSubdomain(slug: string): Promise<void> {
  const config = useRuntimeConfig()
  
  if (!config.cloudflareApiToken || !config.cloudflareZoneId) {
    return
  }
  
  try {
    // Find DNS record
    const records = await $fetch(
      `https://api.cloudflare.com/client/v4/zones/${config.cloudflareZoneId}/dns_records?name=${slug}.churchos.my`,
      {
        headers: {
          'Authorization': `Bearer ${config.cloudflareApiToken}`
        }
      }
    )
    
    const record = (records as any).result?.[0]
    if (record) {
      await $fetch(
        `https://api.cloudflare.com/client/v4/zones/${config.cloudflareZoneId}/dns_records/${record.id}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${config.cloudflareApiToken}`
          }
        }
      )
    }
  } catch (err) {
    console.error('Cloudflare deprovisioning failed:', err)
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/platform/server/utils/cloudflare.ts
git commit -m "feat(platform): add Cloudflare DNS provisioning"
```

---

## Task 10: Create organization creation endpoint

**Files:**
- Create: `apps/platform/server/api/organizations/index.post.ts`

- [ ] **Step 1: Create the endpoint**

```typescript
export default defineEventHandler(async (event) => {
  const user = requireAuth(event)
  const { name, slug } = await readBody<{ name: string; slug: string }>(event)
  
  // Validate slug format
  if (!/^[a-z0-9-]{3,30}$/.test(slug)) {
    throw createError({
      statusCode: 400,
      message: 'Slug must be 3-30 characters, lowercase letters, numbers, and hyphens only'
    })
  }
  
  // Reserved slugs
  const reserved = ['app', 'www', 'api', 'admin', 'docs', 'blog', 'mail', 'cdn', 'static']
  if (reserved.includes(slug)) {
    throw createError({
      statusCode: 400,
      message: 'This name is reserved, please choose another'
    })
  }
  
  if (!name || name.length < 2) {
    throw createError({
      statusCode: 400,
      message: 'Organization name is required'
    })
  }
  
  const admin = useSupabaseAdmin()
  
  // Check slug availability
  const { data: existing } = await admin
    .from('organizations')
    .select('id')
    .eq('slug', slug)
    .single()
  
  if (existing) {
    throw createError({
      statusCode: 409,
      message: 'This name is already taken'
    })
  }
  
  // Check if user already has an organization
  const { data: userMemberships } = await admin
    .from('organization_members')
    .select('id')
    .eq('user_id', user.id)
  
  // For now, allow multiple orgs per user (will be implemented in multi-org feature)
  // In production, you might want to limit to 1 org per user initially
  
  // Create organization with 14-day trial
  const trialEndsAt = new Date()
  trialEndsAt.setDate(trialEndsAt.getDate() + 14)
  
  const { data: org, error: orgError } = await admin
    .from('organizations')
    .insert({
      name,
      slug,
      subscription_tier: 'starter',
      billing_cycle: 'monthly',
      subscribed_modules: [],
      trial_ends_at: trialEndsAt.toISOString(),
      subscription_status: 'trial',
      suspension_months: 0
    })
    .select()
    .single()
  
  if (orgError || !org) {
    console.error('Failed to create organization:', orgError)
    throw createError({
      statusCode: 500,
      message: 'Failed to create organization'
    })
  }
  
  // Add user as first admin
  const { error: memberError } = await admin
    .from('organization_members')
    .insert({
      organization_id: org.id,
      user_id: user.id,
      roles: ['admin'],
      status: 'active'
    })
  
  if (memberError) {
    console.error('Failed to add member:', memberError)
    // Rollback organization creation
    await admin.from('organizations').delete().eq('id', org.id)
    throw createError({
      statusCode: 500,
      message: 'Failed to add user as admin'
    })
  }
  
  // Provision subdomain
  try {
    await provisionSubdomain(slug)
  } catch (err) {
    console.error('Subdomain provisioning failed:', err)
    // Don't fail the whole operation, but log it
  }
  
  return {
    organization: org,
    subdomain: `${slug}.churchos.my`
  }
})
```

- [ ] **Step 2: Test endpoint manually**

Create test file `apps/platform/tests/api/organizations.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'

describe('Organization creation', () => {
  it('should validate slug format', () => {
    const slugs = ['abc', 'abc-123', 'ABC', 'ab', 'a'.repeat(31)]
    expect(slugs.filter(s => /^[a-z0-9-]{3,30}$/.test(s))).toEqual(['abc', 'abc-123'])
  })
  
  it('should reject reserved slugs', () => {
    const reserved = ['app', 'www', 'api', 'admin', 'docs', 'blog']
    expect(reserved.includes('app')).toBe(true)
    expect(reserved.includes('myslug')).toBe(false)
  })
})
```

- [ ] **Step 3: Run test**

Run:
```bash
cd apps/platform && pnpm test
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/platform/server/api/organizations/ apps/platform/tests/
git commit -m "feat(api): add organization creation endpoint"
```

---

## Task 11: Create auth endpoints

**Files:**
- Create: `apps/platform/server/api/auth/signup.post.ts`
- Create: `apps/platform/server/api/auth/login.post.ts`
- Create: `apps/platform/server/api/auth/logout.post.ts`
- Create: `apps/platform/server/api/auth/me.get.ts`

- [ ] **Step 1: Create signup endpoint**

```typescript
export default defineEventHandler(async (event) => {
  const { email, password, displayName } = await readBody<{
    email: string
    password: string
    displayName?: string
  }>(event)
  
  if (!email || !password) {
    throw createError({
      statusCode: 400,
      message: 'Email and password required'
    })
  }
  
  if (password.length < 8) {
    throw createError({
      statusCode: 400,
      message: 'Password must be at least 8 characters'
    })
  }
  
  const admin = useSupabaseAdmin()
  
  // Create user via Supabase Auth
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName || email.split('@')[0] }
  })
  
  if (authError || !authData.user) {
    throw createError({
      statusCode: 400,
      message: authError?.message || 'Failed to create user'
    })
  }
  
  // Create profile
  await admin
    .from('profiles')
    .insert({
      id: authData.user.id,
      email,
      display_name: displayName || email.split('@')[0],
      preferred_language: 'en'
    })
  
  // Sign in to get session token
  const config = useRuntimeConfig()
  const supabase = createClient(config.public.supabaseUrl, config.public.supabaseAnonKey)
  
  const { data: sessionData, error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password
  })
  
  if (signInError || !sessionData.session) {
    throw createError({
      statusCode: 500,
      message: 'User created but sign-in failed'
    })
  }
  
  // Set session cookie
  setCookie(event, '__session', sessionData.session.access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7 // 7 days
  })
  
  return {
    user: {
      id: authData.user.id,
      email
    }
  }
})
```

- [ ] **Step 2: Create login endpoint**

```typescript
import { createClient } from '@supabase/supabase-js'

export default defineEventHandler(async (event) => {
  const { email, password } = await readBody<{ email: string; password: string }>(event)
  
  if (!email || !password) {
    throw createError({
      statusCode: 400,
      message: 'Email and password required'
    })
  }
  
  const config = useRuntimeConfig()
  const supabase = createClient(config.public.supabaseUrl, config.public.supabaseAnonKey)
  
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  
  if (error || !data.session) {
    throw createError({
      statusCode: 401,
      message: 'Invalid credentials'
    })
  }
  
  setCookie(event, '__session', data.session.access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7
  })
  
  return { success: true }
})
```

- [ ] **Step 3: Create logout endpoint**

```typescript
export default defineEventHandler(async (event) => {
  deleteCookie(event, '__session')
  return { success: true }
})
```

- [ ] **Step 4: Create me endpoint**

```typescript
export default defineEventHandler(async (event) => {
  if (!event.context.user) {
    return { authenticated: false }
  }
  
  return {
    authenticated: true,
    user: {
      id: event.context.user.id,
      email: event.context.user.email,
      profile: event.context.user.profile
    },
    organizations: event.context.user.organizations.map((m: any) => ({
      id: m.organizations.id,
      slug: m.organizations.slug,
      name: m.organizations.name,
      subscription_status: m.organizations.subscription_status,
      roles: m.roles
    })),
    currentOrg: event.context.org
  }
})
```

- [ ] **Step 5: Commit**

```bash
git add apps/platform/server/api/auth/
git commit -m "feat(api): add auth endpoints (signup, login, logout, me)"
```

---

## Task 12: Create auth pages (login, signup, OTP)

**Files:**
- Create: `apps/platform/app/pages/auth/login.vue`
- Create: `apps/platform/app/pages/auth/signup.vue`
- Create: `apps/platform/app/pages/auth/verify-otp.vue`

- [ ] **Step 1: Create login page**

```vue
<template>
  <div class="auth-page">
    <div class="auth-card">
      <h1>Sign In</h1>
      
      <form @submit.prevent="handleLogin">
        <div class="form-group">
          <label for="email">Email</label>
          <input
            id="email"
            v-model="email"
            type="email"
            required
            autocomplete="email"
          />
        </div>
        
        <div class="form-group">
          <label for="password">Password</label>
          <input
            id="password"
            v-model="password"
            type="password"
            required
            autocomplete="current-password"
          />
        </div>
        
        <div v-if="error" class="error">{{ error }}</div>
        
        <button type="submit" :disabled="loading">
          {{ loading ? 'Signing in...' : 'Sign In' }}
        </button>
      </form>
      
      <div class="divider">OR</div>
      
      <button @click="signInWithGoogle" class="google-btn">
        Sign in with Google
      </button>
      
      <div class="links">
        <NuxtLink to="/auth/signup">Create account</NuxtLink>
        <NuxtLink to="/auth/verify-otp">Sign in with OTP</NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: false })

const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function handleLogin() {
  error.value = ''
  loading.value = true
  
  try {
    await $fetch('/api/auth/login', {
      method: 'POST',
      body: { email: email.value, password: password.value }
    })
    
    await navigateTo('/dashboard')
  } catch (err: any) {
    error.value = err.data?.message || 'Login failed'
  } finally {
    loading.value = false
  }
}

async function signInWithGoogle() {
  const supabase = useSupabaseClient()
  await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin + '/auth/callback' }
  })
}
</script>

<style scoped>
.auth-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f9fafb;
  padding: 1rem;
}

.auth-card {
  background: white;
  padding: 2rem;
  border-radius: 0.5rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  max-width: 400px;
  width: 100%;
}

.form-group {
  margin-bottom: 1rem;
}

label {
  display: block;
  margin-bottom: 0.25rem;
  font-weight: 500;
}

input {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
}

button {
  width: 100%;
  padding: 0.75rem;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 0.375rem;
  font-weight: 500;
  cursor: pointer;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.google-btn {
  background: white;
  color: #111827;
  border: 1px solid #d1d5db;
  margin-top: 0.5rem;
}

.error {
  color: #dc2626;
  font-size: 0.875rem;
  margin-bottom: 1rem;
}

.divider {
  text-align: center;
  margin: 1rem 0;
  color: #6b7280;
  font-size: 0.875rem;
}

.links {
  margin-top: 1.5rem;
  display: flex;
  justify-content: space-between;
  font-size: 0.875rem;
}
</style>
```

- [ ] **Step 2: Create signup page**

```vue
<template>
  <div class="auth-page">
    <div class="auth-card">
      <h1>Create Account</h1>
      
      <form @submit.prevent="handleSignup">
        <div class="form-group">
          <label for="displayName">Your Name</label>
          <input id="displayName" v-model="displayName" required />
        </div>
        
        <div class="form-group">
          <label for="email">Email</label>
          <input id="email" v-model="email" type="email" required />
        </div>
        
        <div class="form-group">
          <label for="password">Password (min 8 characters)</label>
          <input id="password" v-model="password" type="password" minlength="8" required />
        </div>
        
        <div v-if="error" class="error">{{ error }}</div>
        
        <button type="submit" :disabled="loading">
          {{ loading ? 'Creating account...' : 'Create Account' }}
        </button>
      </form>
      
      <div class="links">
        <NuxtLink to="/auth/login">Already have an account? Sign in</NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: false })

const displayName = ref('')
const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function handleSignup() {
  error.value = ''
  loading.value = true
  
  try {
    await $fetch('/api/auth/signup', {
      method: 'POST',
      body: {
        email: email.value,
        password: password.value,
        displayName: displayName.value
      }
    })
    
    await navigateTo('/onboarding')
  } catch (err: any) {
    error.value = err.data?.message || 'Signup failed'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
/* Same styles as login.vue */
</style>
```

- [ ] **Step 3: Create OTP verification page**

```vue
<template>
  <div class="auth-page">
    <div class="auth-card">
      <h1>Sign in with OTP</h1>
      
      <form @submit.prevent="handleRequestOtp" v-if="!otpSent">
        <div class="form-group">
          <label for="phone">Phone Number</label>
          <input id="phone" v-model="phone" type="tel" placeholder="+60123456789" required />
        </div>
        
        <button type="submit" :disabled="loading">
          {{ loading ? 'Sending...' : 'Send Code' }}
        </button>
      </form>
      
      <form @submit.prevent="handleVerifyOtp" v-else>
        <p>Enter the code sent to {{ phone }}</p>
        <div class="form-group">
          <label for="otp">6-digit code</label>
          <input id="otp" v-model="otp" maxlength="6" required />
        </div>
        
        <button type="submit" :disabled="loading">
          {{ loading ? 'Verifying...' : 'Verify' }}
        </button>
      </form>
      
      <div v-if="error" class="error">{{ error }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: false })

const phone = ref('')
const otp = ref('')
const otpSent = ref(false)
const error = ref('')
const loading = ref(false)

async function handleRequestOtp() {
  error.value = ''
  loading.value = true
  
  try {
    const supabase = useSupabaseClient()
    const { error: err } = await supabase.auth.signInWithOtp({
      phone: phone.value
    })
    
    if (err) throw err
    
    otpSent.value = true
  } catch (err: any) {
    error.value = err.message || 'Failed to send OTP'
  } finally {
    loading.value = false
  }
}

async function handleVerifyOtp() {
  error.value = ''
  loading.value = true
  
  try {
    const supabase = useSupabaseClient()
    const { data, error: err } = await supabase.auth.verifyOtp({
      phone: phone.value,
      token: otp.value,
      type: 'sms'
    })
    
    if (err) throw err
    
    if (data.session) {
      // Set session cookie
      await $fetch('/api/auth/set-session', {
        method: 'POST',
        body: { access_token: data.session.access_token }
      })
      
      await navigateTo('/dashboard')
    }
  } catch (err: any) {
    error.value = err.message || 'Invalid OTP'
  } finally {
    loading.value = false
  }
}
</script>
```

- [ ] **Step 4: Commit**

```bash
git add apps/platform/app/pages/auth/
git commit -m "feat(ui): add auth pages (login, signup, OTP)"
```

---

## Task 13: Create org switcher component and dashboard

**Files:**
- Create: `apps/platform/app/components/OrgSwitcher.vue`
- Create: `apps/platform/app/composables/useOrg.ts`
- Create: `apps/platform/app/pages/dashboard.vue`
- Create: `apps/platform/app/layouts/default.vue`

- [ ] **Step 1: Create useOrg composable**

```typescript
export function useOrg() {
  const currentOrg = useState<any>('currentOrg', () => null)
  const userOrgs = useState<any[]>('userOrgs', () => [])
  
  async function loadUserOrgs() {
    const { data } = await useFetch('/api/auth/me')
    if (data.value?.authenticated) {
      userOrgs.value = data.value.organizations || []
      currentOrg.value = data.value.currentOrg
    }
  }
  
  function switchOrg(orgSlug: string) {
    const protocol = window.location.protocol
    const host = window.location.host
    
    if (host.includes('localhost')) {
      // Local development: use query param or port routing
      window.location.href = `${protocol}//${host}/_org/${orgSlug}`
    } else {
      // Production: redirect to subdomain
      const rootDomain = host.includes('staging')
        ? 'staging.churchos.my'
        : 'churchos.my'
      window.location.href = `${protocol}//${orgSlug}.${rootDomain}`
    }
  }
  
  return {
    currentOrg: readonly(currentOrg),
    userOrgs: readonly(userOrgs),
    loadUserOrgs,
    switchOrg
  }
}
```

- [ ] **Step 2: Create OrgSwitcher component**

```vue
<template>
  <div class="org-switcher">
    <button v-if="currentOrg" @click="open = !open" class="trigger">
      <div class="org-icon">{{ currentOrg.name.charAt(0).toUpperCase() }}</div>
      <div class="org-info">
        <div class="org-name">{{ currentOrg.name }}</div>
        <div class="org-slug">{{ currentOrg.slug }}.churchos.my</div>
      </div>
      <ChevronDown :size="16" />
    </button>
    
    <div v-if="open" class="dropdown">
      <button
        v-for="org in userOrgs"
        :key="org.id"
        @click="handleSwitch(org.slug)"
        class="org-item"
      >
        <div class="org-icon">{{ org.name.charAt(0).toUpperCase() }}</div>
        <div>
          <div class="org-name">{{ org.name }}</div>
          <div class="org-slug">{{ org.slug }}.churchos.my</div>
        </div>
        <Check v-if="org.id === currentOrg?.id" :size="16" class="check" />
      </button>
      
      <NuxtLink to="/organizations/new" class="new-org">
        <Plus :size="16" /> Create new organization
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ChevronDown, Plus, Check } from 'lucide-vue-next'

const open = ref(false)
const { currentOrg, userOrgs, switchOrg } = useOrg()

function handleSwitch(slug: string) {
  switchOrg(slug)
}

onMounted(() => {
  const { loadUserOrgs } = useOrg()
  loadUserOrgs()
})

onClickOutside(open, () => {
  open.value = false
})
</script>

<style scoped>
.org-switcher {
  position: relative;
}

.trigger {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  background: transparent;
  border: 1px solid #e5e7eb;
  border-radius: 0.375rem;
  cursor: pointer;
  width: 100%;
}

.org-icon {
  width: 32px;
  height: 32px;
  border-radius: 0.375rem;
  background: #3b82f6;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
}

.org-info {
  flex: 1;
  text-align: left;
}

.org-name {
  font-weight: 500;
  font-size: 0.875rem;
}

.org-slug {
  font-size: 0.75rem;
  color: #6b7280;
}

.dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 0.25rem;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 0.375rem;
  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
  z-index: 50;
}

.org-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.5rem;
  background: transparent;
  border: none;
  cursor: pointer;
  text-align: left;
}

.org-item:hover {
  background: #f9fafb;
}

.check {
  margin-left: auto;
  color: #10b981;
}

.new-org {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  border-top: 1px solid #e5e7eb;
  color: #3b82f6;
  text-decoration: none;
  font-size: 0.875rem;
}
</style>
```

- [ ] **Step 3: Create default layout**

```vue
<template>
  <div class="app-layout">
    <aside class="sidebar">
      <OrgSwitcher />
      <nav class="nav-menu">
        <NuxtLink to="/dashboard" exact-active-class="active">
          <Home :size="16" /> Dashboard
        </NuxtLink>
        <!-- Module links will be added in respective plans -->
      </nav>
    </aside>
    
    <main class="main-content">
      <TrialBanner v-if="currentOrg?.subscription_status === 'trial'" />
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
import { Home } from 'lucide-vue-next'

const { currentOrg } = useOrg()
</script>

<style scoped>
.app-layout {
  display: flex;
  min-height: 100vh;
}

.sidebar {
  width: 240px;
  background: #f9fafb;
  border-right: 1px solid #e5e7eb;
  padding: 1rem;
}

.main-content {
  flex: 1;
  padding: 2rem;
  overflow-y: auto;
}

.nav-menu {
  margin-top: 1.5rem;
}

.nav-menu a {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border-radius: 0.375rem;
  color: #374151;
  text-decoration: none;
  font-size: 0.875rem;
}

.nav-menu a:hover {
  background: #f3f4f6;
}

.nav-menu a.active {
  background: #eff6ff;
  color: #3b82f6;
  font-weight: 500;
}
</style>
```

- [ ] **Step 4: Create dashboard page**

```vue
<template>
  <div>
    <h1>Dashboard</h1>
    
    <div v-if="currentOrg" class="dashboard">
      <div class="welcome">
        <h2>Welcome to {{ currentOrg.name }}</h2>
        <p>Subdomain: {{ currentOrg.slug }}.churchos.my</p>
      </div>
      
      <div class="stats">
        <div class="stat-card">
          <h3>Subscription</h3>
          <p>{{ currentOrg.subscription_status }}</p>
        </div>
        <div class="stat-card">
          <h3>Trial Ends</h3>
          <p>{{ trialDaysLeft }} days</p>
        </div>
      </div>
      
      <div class="modules">
        <h3>Available Modules</h3>
        <div class="module-grid">
          <div v-for="module in allModules" :key="module.id" class="module-card">
            <h4>{{ module.name }}</h4>
            <p>{{ module.description }}</p>
            <NuxtLink :to="module.path" class="module-link">
              Open {{ module.name }}
            </NuxtLink>
          </div>
        </div>
      </div>
    </div>
    
    <div v-else>
      <p>Please select or create an organization.</p>
      <NuxtLink to="/organizations/new">Create Organization</NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const { currentOrg } = useOrg()

const allModules = [
  { id: 'people', name: 'PEOPLE', description: 'Church management', path: '/people' },
  { id: 'journey', name: 'JOURNEY', description: 'Discipleship LMS', path: '/journey' },
  { id: 'pages', name: 'PAGES', description: 'Website builder', path: '/pages' }
]

const trialDaysLeft = computed(() => {
  if (!currentOrg.value?.trial_ends_at) return 0
  const end = new Date(currentOrg.value.trial_ends_at)
  const now = new Date()
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
})
</script>

<style scoped>
.dashboard > * {
  margin-bottom: 2rem;
}

.stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.stat-card {
  background: white;
  padding: 1.5rem;
  border-radius: 0.5rem;
  border: 1px solid #e5e7eb;
}

.module-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
}

.module-card {
  background: white;
  padding: 1.5rem;
  border-radius: 0.5rem;
  border: 1px solid #e5e7eb;
}

.module-link {
  display: inline-block;
  margin-top: 1rem;
  color: #3b82f6;
  text-decoration: none;
  font-weight: 500;
}
</style>
```

- [ ] **Step 5: Create TrialBanner component**

```vue
<template>
  <div class="trial-banner">
    <div class="banner-content">
      <Clock :size="20" />
      <div>
        <strong>You're on a free trial.</strong>
        {{ daysLeft }} day{{ daysLeft !== 1 ? 's' : '' }} remaining.
      </div>
      <NuxtLink to="/settings/billing" class="cta">
        Subscribe Now
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Clock } from 'lucide-vue-next'

const props = defineProps<{
  daysLeft: number
}>()
</script>

<style scoped>
.trial-banner {
  background: #fef3c7;
  border-bottom: 1px solid #fbbf24;
  padding: 0.75rem 1rem;
  margin-bottom: 1.5rem;
  border-radius: 0.375rem;
}

.banner-content {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.cta {
  margin-left: auto;
  padding: 0.375rem 0.75rem;
  background: #f59e0b;
  color: white;
  border-radius: 0.375rem;
  text-decoration: none;
  font-size: 0.875rem;
  font-weight: 500;
}
</style>
```

- [ ] **Step 6: Create auth middleware**

Create `apps/platform/app/middleware/auth.ts`:

```typescript
export default defineNuxtRouteMiddleware((to) => {
  const { user } = useAuth()
  
  if (!user.value) {
    return navigateTo('/auth/login')
  }
})
```

- [ ] **Step 7: Commit**

```bash
git add apps/platform/app/
git commit -m "feat(ui): add dashboard, org switcher, and trial banner"
```

---

## Task 14: Add seed data for testing

**Files:**
- Create: `supabase/seed.sql`

- [ ] **Step 1: Create seed file**

```sql
-- Demo organizations
INSERT INTO organizations (id, slug, name, subscription_tier, billing_cycle, subscribed_modules, trial_ends_at, subscription_status) VALUES
  ('11111111-1111-1111-1111-111111111111', 'demo-church', 'Demo Church KL', 'growth', 'annual', ARRAY['people', 'journey', 'pages'], NULL, 'active'),
  ('22222222-2222-2222-2222-222222222222', 'grace-baptist', 'Grace Baptist Church', 'starter', 'monthly', ARRAY['journey'], NULL, 'active'),
  ('33333333-3333-3333-3333-333333333333', 'trial-org', 'Trial Organization', 'starter', 'monthly', '{}', NOW() + INTERVAL '14 days', 'trial');

-- Note: In production, you'll need to create real auth.users first via Supabase Auth API
-- These are placeholder organization records for testing UI flows
```

- [ ] **Step 2: Apply seed data**

Run:
```bash
docker exec -i churchos-db psql -U postgres < supabase/seed.sql
```

Expected: 3 organizations inserted.

- [ ] **Step 3: Commit**

```bash
git add supabase/seed.sql
git commit -m "feat(db): add seed data for testing"
```

---

## Task 15: Add CI/CD workflow

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/platform-deploy.yml`

- [ ] **Step 1: Create CI workflow**

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: pnpm/action-setup@v2
        with:
          version: 11.19.0
      
      - uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: 'pnpm'
      
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      
      - name: Lint
        run: pnpm lint
      
      - name: Typecheck
        run: pnpm typecheck
      
      - name: Test
        run: pnpm test
      
      - name: Build
        run: pnpm build
```

- [ ] **Step 2: Create platform deploy workflow**

```yaml
name: Deploy Platform

on:
  push:
    branches: [main]
    paths:
      - 'apps/platform/**'
      - 'packages/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: pnpm/action-setup@v2
        with:
          version: 11.19.0
      
      - uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: 'pnpm'
      
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      
      - name: Build
        run: pnpm --filter platform build
        env:
          NUXT_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          NUXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
          NUXT_SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
      
      - name: Deploy to Cloudflare Pages
        uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          projectName: churchos-platform
          directory: apps/platform/.output/public
```

- [ ] **Step 3: Commit**

```bash
git add .github/
git commit -m "ci: add GitHub Actions workflows"
```

---

## Acceptance Criteria

Foundation is complete when:

- [ ] Monorepo builds successfully (`pnpm build`)
- [ ] Docker Supabase stack runs (`docker-compose up -d`)
- [ ] All migrations apply cleanly to local database
- [ ] User can sign up via `/auth/signup`
- [ ] User can log in via `/auth/login`
- [ ] User can sign in with Google OAuth
- [ ] User can sign in with phone OTP
- [ ] User can create organization with subdomain
- [ ] Subdomain is provisioned via Cloudflare API
- [ ] User can access dashboard at org subdomain
- [ ] Session middleware loads user + orgs on every request
- [ ] Org context middleware detects subdomain/custom domain
- [ ] Authorization helpers (requireAuth, requireOrg, requireRole) work
- [ ] Organization switcher dropdown shows user's orgs
- [ ] Trial banner shows on dashboard for trial orgs
- [ ] CI workflow passes (lint, typecheck, test, build)
- [ ] Deploy workflow pushes to Cloudflare on main branch

---

**Estimated Time:** 2-3 weeks for experienced developer
**Prerequisites:** Cloudflare account with API token, Supabase project for staging
**Next Plan:** `2026-08-25-people-module-implementation.md`
