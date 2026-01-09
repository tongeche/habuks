# JONGOL Foundation

Member dashboard for JONGOL Foundation - a Kenya-based self-help group of 12 members.

## Quick Start

```bash
npm install
cp .env.example .env   # Add Supabase credentials
npm run dev
```

## Tech Stack

- React + Vite
- Supabase (PostgreSQL + Auth)

## Database Setup

Run migrations in Supabase SQL Editor (in order):
1. `supabase/schema.sql`
2. `supabase/migration_002.sql` → `migration_007_admin_invites.sql`

---
Made with ❤️ for JONGOL Foundation
