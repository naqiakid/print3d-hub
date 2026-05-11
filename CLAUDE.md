# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev        # start dev server on localhost:3000
npm run build      # production build
npm run lint       # ESLint
npx tsc --noEmit   # type-check without emitting (no test suite exists yet)
```

## Stack

- **Next.js 16.2.6** — App Router only. `params` in dynamic routes is a `Promise` and must be awaited.
- **React 19** — Server Components by default. Add `'use client'` only for interactivity (state, events).
- **Tailwind CSS v4** — uses `@import "tailwindcss"` in globals.css, not the v3 `@tailwind` directives.
- **Supabase** (`@supabase/ssr` v0.10.3) — browser client in `src/lib/supabase/client.ts`, server client in `src/lib/supabase/server.ts`. Never use `@supabase/auth-helpers-nextjs`.
- **TypeScript strict mode** — path alias `@/*` → `./src/*`.

## Architecture

### Two user types, one database

**Customers** — no account. Submit requests via `/request/[printerId]`. Identified only by name + email + phone in the `requests` table.

**Printer owners** — Supabase Auth. One printer per owner (MVP constraint). Flow: `/signup` → `/register` → `/dashboard`.

### Data flow

All data mutations go through **server actions** in `src/lib/actions.ts` (`'use server'` at file top). Client components import and call these directly — Next.js serialises the call over POST.

Server reads (browse, detail, dashboard) happen inside **async Server Components** using `src/lib/supabase/server.ts`. Supabase data is cast `as unknown as Printer` / `as unknown as PrintRequest[]` because the JS SDK returns untyped JSON.

### Printer abstraction layer

Owners enter technical specs; customers see plain language. All mappings live in `src/lib/types.ts`:
- Print type: `everyday | strong | colorful` (no resin/detailed in MVP — FDM only)
- Material: `rigid | flexible | tough` (maps to PLA/PETG, TPU, Nylon/PC)
- Size: `small | medium | large` (up to 10cm / 25cm / 25cm+)
- Quality: `draft | standard | premium` (0.3mm / 0.2mm / 0.1mm layer height)

### Request status lifecycle

```
new → quoted → accepted → printing → done → collected → reviewed
         ↓                                    (review email sent)
      declined
new → declined
quoted → cancelled
```

Status transitions are triggered by the owner in `RequestCard` (client component), which calls `updateRequestStatus` or `sendQuote` server actions. After each action, `revalidatePath('/dashboard')` causes the server component to re-fetch.

### Route map

| Route | Auth required | Notes |
|---|---|---|
| `/` | No | Homepage with featured printers |
| `/printers` | No | Browse — reads from Supabase |
| `/printers/[id]` | No | Detail page — dynamic, reads from Supabase |
| `/request/[printerId]` | No | Request form — inserts into `requests` |
| `/signup` `/login` | No (redirects if authed) | Handled by middleware |
| `/register` | Yes | 3-step wizard → inserts into `printers` |
| `/dashboard` | Yes | Owner job queue + stats |
| `/dashboard/listing` | Yes | Edit printer / toggle availability |

Middleware (`middleware.ts`) protects `/dashboard` and `/register` — redirects unauthenticated users to `/login?next=<path>` and redirects authenticated users away from `/login` and `/signup`.

## Environment

Requires `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

See `env.example` for reference. The schema to initialise the database is in `supabase/schema.sql` — run it in the Supabase SQL Editor.
