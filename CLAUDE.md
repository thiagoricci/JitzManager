# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server at http://localhost:5173
npm run build        # Production build
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit on the app + node tsconfigs
npm test             # Run the Vitest suite once
npm run test:watch   # Vitest in watch mode
npm run preview      # Preview production build

supabase db push                        # Apply migrations to linked project
supabase migration new <name>           # Create new migration file
supabase functions deploy               # Deploy all edge functions
supabase functions deploy <name>        # Deploy a single edge function

npx shadcn@latest add <component>       # Add a shadcn/ui component
```

## Architecture

### Testing & CI

Tests run on **Vitest** (config in `vitest.config.ts`). Two kinds of tests:

- **Unit tests** are co-located (e.g. `src/lib/date.test.ts`) and cover pure logic like the timezone helpers.
- **RLS tests** in `tests/rls/` prove tenant isolation by running the *real* migrations against Postgres and querying as different users. `tests/rls/supabase-shim.sql` recreates the Supabase-provided pieces (the `auth`/`storage` schemas, `auth.uid()`/`auth.jwt()`/`auth.role()`, and the standard roles) so the migration SQL runs unmodified on a plain Postgres. Users are impersonated inside a transaction via `SET LOCAL ROLE authenticated` + `request.jwt.claims`.

The RLS suite is **skipped** unless `TEST_DATABASE_URL` (or `DATABASE_URL`) points at a Postgres instance, so `npm test` works locally without a database. To run it locally: `createdb jitz_rls_test && TEST_DATABASE_URL=postgresql://<user>@localhost:5432/jitz_rls_test npm test`.

CI (`.github/workflows/ci.yml`) runs `lint` + `typecheck` + `test` (with a Postgres service) on every PR and push to `main`. Make these the required status checks in branch protection so failures block merge.

### Multi-Tenant Model

Every piece of data belongs to an `organization`. RLS policies on all tables enforce tenant isolation using the pattern:

```sql
organization_id IN (
  SELECT organization_id FROM profiles WHERE id = auth.uid()
)
```

Platform admin access is hardcoded by email in RLS policies (`thiago@reivien.com`).

### Auth Flow

`AuthContext` (`src/contexts/AuthContext.tsx`) is the single source of truth for auth state. It loads in sequence: Supabase session → `profiles` table → `organizations` table. Components consume `useAuth()` to get `{ session, user, profile, organization }`.

`ProtectedRoute` enforces three states: unauthenticated → `/login`, authenticated but no `profile.organization_id` → `/onboarding`, fully set up → render children.

There are two separate auth tiers: gym users (`/login`) and platform admin (`/admin/login` → `/admin`).

### Data Fetching

All data fetching uses **TanStack Query** with the Supabase client from `src/lib/supabase.ts`. Query keys always include `organization?.id`. Mutations use `useQueryClient()` to invalidate related queries on success. Toasts for user feedback use `sonner`.

### Routing / Layout

Routes are defined in `src/App.tsx`. Authenticated pages are wrapped as `<ProtectedRoute><Layout><Page /></Layout></ProtectedRoute>`. The `Layout` component renders `AppSidebar` + main content. To add a new page: create in `src/pages/`, add route in `App.tsx`, add nav entry in `AppSidebar.tsx`.

### Stripe Integration

All Stripe operations go through **Supabase Edge Functions** (Deno runtime) in `supabase/functions/`. The frontend never holds a secret key — it calls edge functions, which use `STRIPE_SECRET_KEY` from environment. There are two distinct Stripe flows:
- **Gym-to-student payments**: Stripe Connect Express accounts linked per organization via `stripe_account_id`
- **Platform subscriptions**: Gyms pay for access to the platform itself via `platform_subscriptions` table

The `stripe-webhook` edge function handles all Stripe webhook events using signature verification.

### Date/Timezone Handling

All date display is timezone-aware. The organization's `timezone` field drives all date formatting. Use utilities from `src/lib/date.ts` (`formatDate`, `getTodayInTimezone`, `getDayOfWeekInTimezone`) rather than raw `date-fns` functions. Plain `YYYY-MM-DD` strings (join dates, birth dates) are parsed as local calendar dates to avoid timezone shifts.

### Database Migrations

Migrations live in `supabase/migrations/`. The full schema is consolidated in `00000_initial_schema.sql`. New incremental migrations go in new numbered files. The `supabase/migrations/_archived/` folder contains old incremental migrations that have been consolidated.

### UI Components

shadcn/ui primitives are in `src/components/ui/` (Radix UI based, configured via `components.json`). Domain-specific components are in `src/components/`. Dashboard charts are in `src/components/dashboard/`. The `@/` path alias maps to `src/`.

### Environment Variables

```
VITE_SUPABASE_URL         # Supabase project URL
VITE_SUPABASE_ANON_KEY    # Supabase anon/public key
VITE_STRIPE_PUBLISHABLE_KEY  # Stripe publishable key (optional for local dev)
```

Edge functions read `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SIGNING_SECRET`, and `SUPABASE_SERVICE_ROLE_KEY` from Supabase's secrets store.
