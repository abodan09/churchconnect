# ChurchConnect v2

A self-hosted, AI-enhanced church management platform. **Version 2** is a ground-up
rewrite on **Next.js + Supabase**, replacing v1's Base44 backend to eliminate the
authentication/proxy fragility that plagued the original.

## Stack

| Layer | v1 | v2 (this) |
|-------|----|-----------|
| Framework | React + Vite (SPA) | Next.js 15 (App Router, SSR) |
| Auth | Base44 SDK + CORS proxy | Supabase Auth (cookie sessions) |
| Database | Base44 entities | Supabase Postgres + Row-Level Security |
| File storage | Base44 integrations | Supabase Storage (`church-assets` bucket) |
| AI | Anthropic Claude (SSE) | Anthropic Claude (SSE) — unchanged |

Why the change: every login bug we chased in v1 (proxy rewrites, CORS, token
persistence, off-domain redirects) was rooted in the Base44 SDK's hosted-auth model.
Supabase Auth runs same-origin with first-class Next.js cookie handling, removing that
entire class of problems, and Postgres RLS expresses the 6-role permission model far
more robustly than the previous setup.

## Features (carried over from v1)

- **Members** directory with full CRUD and status tracking
- **Giving** with per-type/payment-method tracking and live totals
- **Expenditures** with an approval workflow
- **Events** (public/private) and **Attendance** check-in
- **Sermons**, **Properties/assets**, **Departments**
- **Reports** and **Attendance analytics**
- **Member portal** (self-service giving history + events)
- **Church settings** (name, logo, language, 10 currencies) + first-run setup wizard
- **AI assistant** — 4 domain agents (pastoral, finance, events, communications) streaming from Claude

## Roles

`super_admin` · `pastor_admin` · `finance_officer` · `department_head` · `data_entry_staff` · `member`

Access is enforced in two layers: navigation/UI gating (`src/lib/constants.js`) and
database Row-Level Security policies (`supabase/migrations/0001_init.sql`).

## Getting started

### 1. Create a Supabase project
At [app.supabase.com](https://app.supabase.com), create a project. Then in the **SQL Editor**,
run the contents of `supabase/migrations/0001_init.sql`. (Optionally run `supabase/seed.sql`
for sample data.)

### 2. Configure environment
Copy `.env.example` to `.env.local` and fill in:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
ANTHROPIC_API_KEY=sk-ant-...
```

### 3. Run
```bash
npm install
npm run dev
```

Open http://localhost:3000. Register the first account, then promote it to
`super_admin` in the Supabase **Table editor** (`profiles.role`). Log back in and you'll
be routed through the church setup wizard.

### Promoting the first admin
New sign-ups default to the `member` role (via the `handle_new_user` trigger). The very
first super-admin must be set manually in Supabase:

```sql
update public.profiles set role = 'super_admin' where email = 'you@example.com';
```

## Deploying

Deploy to Vercel (or any Next.js host). Set the four environment variables above in the
host's project settings. No proxy or CORS configuration is required — Supabase Auth and
the API routes run on the app's own origin.

## Project structure

```
src/
  app/
    (app)/            authenticated pages (sidebar shell) — dashboard, members, giving, …
    login, register, forgot-password, reset-password, setup
    api/ai/route.js   Claude streaming endpoint (4 agents)
    auth/callback     Supabase code exchange
  components/         Sidebar, AIAssistant, providers, UI primitives
  lib/
    supabase/         browser + server clients, session middleware
    constants.js      roles, nav, enums, currencies
    utils.js          cn(), currency/date formatters
supabase/
  migrations/0001_init.sql   schema, RLS, triggers, storage
  seed.sql                   optional dev data
```
