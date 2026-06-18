# ChurchConnect — Development Methodology

This project follows a structured multi-framework methodology drawn from:
- **Superpowers** (obra/superpowers) — 7-stage workflow with TDD and mandatory code review
- **GSD / Get Shit Done** (gsd-build/get-shit-done) — spec-first, context-engineered development
- **metaswarm** (dsifry/metaswarm) — specialised agent personas per domain, parallel review gates
- **Claude Agents Library** (aiagentskit/claude-agents-library) — 4 production agent configurations embedded in the app

---

## Project Overview

ChurchConnect is a self-hosted, AI-enhanced church management CRM.

**Stack:** React 18 + Vite + Tailwind + shadcn/ui + Base44 SDK (backend) + Anthropic Claude (AI layer)

**Deployed at:** Vercel (`vercel --prod` from repo root)

**Key env vars required:**
```
VITE_BASE44_APP_BASE_URL=https://api.base44.app
ANTHROPIC_API_KEY=sk-ant-...
BASE44_API_URL=https://api.base44.app
```

---

## Domain Agents (metaswarm pattern)

Each church domain has a dedicated agent persona defined in `api/ai.js`:

| Agent | Domain | Triggered by |
|-------|--------|-------------|
| `pastoral` | Members, care, general | Default — all users |
| `finance` | Giving trends, expenses | Finance pages |
| `events` | Scheduling, announcements | Events page |
| `communications` | Drafts, messages | Anywhere |

When adding AI capability to a feature, route through the appropriate agent via `POST /api/ai` with `{ agentType, messages, context }`.

---

## Feature Development Workflow (Superpowers + GSD)

### Stage 0 — Spec (GSD)
Before writing any code, write a spec:
- What problem does this solve?
- Who uses it (role)?
- What entities does it touch?
- What are the acceptance criteria?

### Stage 1 — Brainstorm
Explore existing pages and utilities before creating anything new. Reuse patterns from existing pages (e.g., `Members.jsx` for table + modal patterns).

### Stage 2 — Plan
Break the work into 2–5 minute tasks. Name the exact files to create or modify.

### Stage 3 — Implement
- One concern per file
- No comments unless the WHY is non-obvious
- Entity data via `base44.entities.<Entity>.list/create/update/delete`
- Auth checks via `useAuth()` hook
- Settings via `useChurchSettings()` hook

### Stage 4 — Test
- Verify the golden path manually with `npm run dev`
- Check all role-based access (super_admin, member)
- Check error states (failed API call, empty data)

### Stage 5 — Code Review
- No dead code, no unused imports
- Tailwind only (no inline styles except dynamic values)
- All async calls wrapped in try/catch

### Stage 6 — Deploy
```bash
vercel --prod
```

---

## File Conventions

```
src/
  pages/        — one file per route, named <FeaturePage>.jsx
  components/   — shared UI components
  components/ui/ — shadcn primitives (do not modify)
  lib/          — contexts, hooks, utilities
  api/          — Base44 client config
api/
  ai.js         — Anthropic streaming endpoint
  base44/       — Base44 CORS proxy
```

---

## Entity CRUD Pattern

```jsx
import { base44 } from '@/api/base44Client';

// List
const items = await base44.entities.Member.list({ limit: 100 });

// Create
const created = await base44.entities.Member.create({ first_name: 'John', last_name: 'Doe' });

// Update
const updated = await base44.entities.Member.update(id, { membership_status: 'inactive' });

// Delete
await base44.entities.Member.delete(id);
```

---

## AI Integration Pattern

```jsx
// In a component — call the streaming AI endpoint
const response = await fetch('/api/ai', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    agentType: 'finance',       // pastoral | finance | events | communications
    messages: [{ role: 'user', content: 'Summarise this month\'s giving' }],
    context: `Church: ${settings.church_name}\nTotal giving: ${total}`,
  }),
});
// Stream the SSE response — see src/components/AIAssistant.jsx for reference implementation
```

---

## Roles Reference

| Role | Access |
|------|--------|
| `super_admin` | Everything |
| `pastor_admin` | All except Departments & Church Settings |
| `finance_officer` | Dashboard, Giving, Expenditures, Reports |
| `department_head` | Dashboard, Events, Attendance, Sermons |
| `data_entry_staff` | Dashboard, Members, Giving, Attendance |
| `member` | Member Portal only |
