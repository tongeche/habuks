# Habuks Console

HabuKS operations platform for managing workspace members, projects, transactions, and internal support workflows through a React frontend backed by Supabase.

## What This App Includes

- Tenant workspace and member management
- Internal admin console for tenant support operations
- Activity logs and tenant health/deployment views
- Supabase-backed auth, data, and Edge Function support tooling

## Tech Stack

- Frontend: React 18 + Vite
- Backend: Supabase (Postgres, Auth, Edge Functions)
- Routing: React Router

## Prerequisites

- Node.js 20+ and npm 10+
- Supabase project (URL, anon key, service role key)
- `psql` (required for seed scripts that run SQL files locally)

## Quick Start

1. Install dependencies:

```bash
npm ci
```

2. Configure environment:

```bash
cp .env.example .env
```

3. Run local development:

```bash
npm run dev
```

4. Build production bundle:

```bash
npm run build
```

## Environment Variables

Use `.env.example` as the source of truth. Required variables for standard usage:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Additional optional variables support meeting-minutes AI integration.

Server-only values such as `SUPABASE_SERVICE_ROLE_KEY` must never be exposed in browser code.

## Scripts

- `npm run dev` - Start Vite dev server
- `npm run build` - Build production assets into `dist/`
- `npm run preview` - Preview built app
- `npm run test` - Run test suite
- `npm run templates:upload` - Upload organization templates to Supabase storage
- `npm run seed:demo` - Seed full sample data set (requires `SUPABASE_PULLING`)
- `npm run seed:demo:projects` - Seed sample project tables only
- `npm run seed:demo:heavy` - Seed heavier sample data set
- `npm run seed:demo:heavy:projects` - Seed heavier project tables only

## Deployment Checklist

1. Set all required environment variables in your deployment platform.
2. Run tests and build locally:

```bash
npm run test
npm run build
```

3. Apply Supabase migrations in order (`supabase/schema.sql`, then `supabase/migration_*.sql`).
4. Deploy required Supabase Edge Functions (for example `admin-shell`) and configure function secrets.
5. Deploy static frontend output from `dist/` to your hosting provider.



## License

No open-source license is declared in this repository. Treat as proprietary unless stated otherwise.
