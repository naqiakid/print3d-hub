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

### Multi-query pattern for owner's printer

All dashboard pages that need the owner's printer use this pattern (never `.single()` — multiple rows can exist from test registrations):

```ts
const { data: printerData } = await supabase
  .from('printers')
  .select('*')
  .eq('owner_id', user.id)
  .order('created_at', { ascending: false })
  .limit(1)
  .maybeSingle()
```

### Material type system

`FilamentMaterial` (in `src/lib/types.ts`) uses specific filament names, not abstract categories:

```ts
type FilamentMaterial = 'pla' | 'petg' | 'abs' | 'tpu' | 'nylon' | 'pc'
```

`MaterialFeel` is a deprecated alias kept for backwards compatibility — do not use it in new code.

Each printer model in `src/lib/printer-models.ts` has a curated `materials` list based on its enclosure type (open-frame = PLA/PETG only; enclosed = full range).

### Automatic pricing system

Cost-based pricing lives in `src/lib/pricing.ts`. Owners set:
- `filament_costs` (JSONB) — cost per kg per material (e.g. `{ pla: 55, petg: 70 }`)
- `power_watts` — printer wattage
- `electricity_rate` — RM per kWh (default 0.57)
- `markup_percent` — profit margin (default 30%)

Formula: `filament_cost = (weight_g / 1000) * cost_per_kg` + `electricity_cost = hours * (power_watts / 1000) * rate`, then `× (1 + markup/100)`.

Print profile adjustments:
- Nozzle multipliers: 0.2mm=2×, 0.4mm=1×, 0.6mm=0.65×, 0.8mm=0.5× (affects print time)
- Infill scaling: `weight_g = base_weight_g * (profile_infill / default_infill)` (affects filament use)
- Ironing: +15% print time

### Print profiles

Each printer can have multiple `print_profiles` (table in DB). A profile defines:
- `nozzle_mm` — 0.2 / 0.4 / 0.6 / 0.8
- `infill_draft / infill_standard / infill_premium` — % per quality tier
- `supports_available` — whether owner can print support structures
- `ironing_available` — whether owner offers ironing add-on
- `is_default` — one profile per printer is flagged as default (shown first to customers)

Managed via `ProfileManager` client component at `/dashboard/profiles`. CRUD actions: `createProfile`, `updateProfile`, `deleteProfile` in `src/lib/actions.ts`.

### Navbar auth state

`Navbar.tsx` is an async Server Component that reads auth on every request. When logged in it renders `UserMenu.tsx` (client component) — a dropdown with Dashboard, Print profiles, Account settings, and Logout. When logged out it shows the original Log in / List Your Printer buttons.

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
| `/dashboard/listing` | Yes | View listing, toggle availability (real Supabase data) |
| `/dashboard/profiles` | Yes | Manage print profiles (CRUD) |
| `/dashboard/account` | Yes | Account settings — email display, change password |

Middleware (`middleware.ts`) protects `/dashboard` and `/register` — redirects unauthenticated users to `/login?next=<path>` and redirects authenticated users away from `/login` and `/signup`.

## Database

Schema is in `supabase/schema.sql`. Run it in the Supabase SQL Editor to initialise a fresh project.

`supabase/migration_print_profiles.sql` — standalone migration that adds the `print_profiles` table and adds cost columns to `printers`. Apply this if the project was initialised before Phase 2.

### Key tables

- `printers` — one row per owner. Includes `filament_costs` (JSONB), `power_watts`, `electricity_rate`, `markup_percent`, `available`.
- `print_profiles` — many per printer. RLS: public read, owner-only write.
- `requests` — customer requests. RLS: public insert, owner read/update.

## What's built (Phase summary)

**Phase 1 — Storefront (complete)**
- Homepage, browse `/printers`, printer detail `/printers/[id]`
- Customer request form `/request/[printerId]`
- All reads from Supabase

**Phase 2 — Owner backend (complete)**
- Auth: signup, login, logout, middleware
- Printer registration wizard (`/register`) — 3 steps: basics, cost setup, review
- Dashboard with job queue, stats, tab filters
- Request cards with status workflow (quote, accept, printing, done)
- Print profiles CRUD (`/dashboard/profiles`)
- Listing management with availability toggle (`/dashboard/listing`)
- Account settings with password change (`/dashboard/account`)
- Auth-aware navbar with user dropdown

**Phase 3 — Slicer integration (planned)**
- STL upload + 3D model preview in browser (Three.js / model-viewer)
- PrusaSlicer CLI backend in Docker — owner-defined slicer profiles
- Customer flow: upload STL → choose profile → get instant price → submit
- Owner receives pre-sliced file with exact weight/time data

**Phase 4 — Customer experience (planned)**
- Customer tracking page `/track/[requestId]`
- Confirmation email when owner accepts a job
- Review/rating system post-collection
- Customer request form: profile picker + add-on toggles + live price estimate

## Environment

Requires `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

See `env.example` for reference.
