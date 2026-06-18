# ChurchConnect

A self-hosted, AI-enhanced church management platform built with React + Vite + Tailwind.

## Features

- Member management with role-based access
- Giving & expenditure tracking with financial reports
- Events, attendance, and sermon management
- Department and property management
- AI assistant with 4 church-specific agent personas (pastoral, finance, events, communications)

## Stack

- **Frontend:** React 18 + Vite + Tailwind CSS + shadcn/ui
- **Backend:** Base44 SDK (auth + entity CRUD)
- **AI:** Anthropic Claude (`claude-sonnet-4-6`) via Vercel serverless functions
- **Deployment:** Vercel

## Getting Started

```bash
npm install
npm run dev
```

Create a `.env` file at the project root:

```
VITE_BASE44_APP_BASE_URL=https://api.base44.app
```

## Deployment

```bash
vercel --prod
```

Required Vercel environment variables:

```
VITE_BASE44_APP_BASE_URL=https://api.base44.app
ANTHROPIC_API_KEY=sk-ant-...
```

## Roles

| Role | Access |
|------|--------|
| `super_admin` | Full access |
| `pastor_admin` | All except Departments & Church Settings |
| `finance_officer` | Dashboard, Giving, Expenditures, Reports |
| `department_head` | Dashboard, Events, Attendance, Sermons |
| `data_entry_staff` | Dashboard, Members, Giving, Attendance |
| `member` | Member Portal only |
