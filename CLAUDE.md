# ChurchConnect v2 — Development Guide

ChurchConnect is a self-hosted, AI-enhanced church management CRM. **v2** runs on
**Next.js 15 (App Router) + Supabase (Postgres/Auth/Storage) + Anthropic Claude**.

> v1 was a React/Vite SPA on the Base44 backend. v2 replaced it to fix the auth/proxy
> fragility — do not reintroduce Base44 SDK, CORS proxies, or token-in-URL patterns.

## Stack & conventions

- **Pages** live under `src/app/`. Authenticated pages go in the `(app)` route group so
  they share the sidebar shell in `src/app/(app)/layout.jsx` (a server component that
  loads the user profile + church settings and enforces auth).
- **Auth** is Supabase Auth. Sessions are cookie-based and refreshed in
  `src/middleware.js` → `src/lib/supabase/middleware.js`. Never hand-roll token storage.
- **Data access**:
  - Server components / route handlers: `import { createClient } from '@/lib/supabase/server'` (async).
  - Client components: get `supabase` from `useApp()` (`@/components/providers`).
- **Permissions** are enforced in Postgres RLS (`supabase/migrations/0001_init.sql`) AND
  mirrored for UI gating in `src/lib/constants.js` (`navForRole`, role arrays in pages).
  When you add a table, add RLS policies — do not rely on UI gating alone.
- **Currency**: format via `fmt()` from `useApp()` or `formatCurrency()` in `@/lib/utils`.
- **Styling**: Tailwind only. Shared primitives in `src/components/ui/` (Button, Field,
  Card, Modal, Misc). Reuse them; match the existing page structure.
- **JavaScript/JSX**, not TypeScript. Client pages start with `'use client'`.

## The CRUD page pattern

`src/app/(app)/members/page.jsx` is the canonical reference: `useApp()` for
`{ supabase, role, fmt }`, a `useCallback` loader + `useEffect`, a `Modal` create/edit
form, search/filter state, role-gated action buttons, a red `bg-destructive/10` error
banner, `confirm()` before delete, and `'' → null` normalization on save. New entity
pages should mirror it.

## Roles

`super_admin` (everything), `pastor_admin` (all except Departments & Church Settings),
`finance_officer` (Dashboard, Giving, Expenditures, Properties, Reports),
`department_head` (Dashboard, Events, Attendance, Sermons, Analytics),
`data_entry_staff` (Dashboard, Members, Giving, Attendance), `member` (Portal only).

New sign-ups default to `member` (auth trigger). Promote the first admin via SQL in
Supabase (`update profiles set role='super_admin' where email=…`).

## AI integration

`POST /api/ai` with `{ agentType, messages, context }` streams Claude (`claude-sonnet-4-6`)
as SSE. Agents: `pastoral | finance | events | communications`. The floating widget is
`src/components/AIAssistant.jsx`. To add AI to a feature, build a `context` string and
POST to the route — see the widget for the SSE-reading reference.

## Local workflow

1. Run `supabase/migrations/0001_init.sql` in the Supabase SQL editor.
2. `.env.local` with the 4 vars (see `.env.example`).
3. `npm run dev` → http://localhost:3000.
4. Verify role-based access and the golden path (register → promote → setup → dashboard).
5. `npm run build` before committing.
