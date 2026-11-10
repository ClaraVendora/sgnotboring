---
name: new-migration
description: Create a forward-only, additive Supabase migration, prove it applies clean locally with db:reset, and update seed data if needed. Usage - /new-migration <snake_case_name>
---

Create a migration: `$ARGUMENTS` (snake_case, describes the change: `add_places_cuisine`, `create_saved_places`).

## Rules (from CLAUDE.md)

- Schema changes are **only** migration files in `supabase/migrations/`. Never edit the hosted DB in Studio.
- **Forward-only and additive.** There is no rollback. Add columns/tables now; drop or rename in a *later* PR after the code stops using the old shape, because Railway deploys the app in parallel with the migration.
- Idempotent where cheap (`if not exists`, `drop ... if exists` before `create policy/trigger`).
- New tables: enable RLS and add an explicit read policy (see `20260911000000_create_places.sql`). Writes go through the service role key, so no write policies for `anon`.
- **Put objects in the owning service's schema** (`catalog` = Places, `accounts` = Accounts, `community` =
  Community) and always schema-qualify names (`create table community.x`). No foreign keys or function reads
  across schemas; a reference to another service's row is a plain id the service checks over HTTP.
  A brand-new schema also needs `grant usage`, `config.toml` `[api] schemas`, and the hosted Data API
  *Exposed schemas* setting on both projects (call that out in the PR).
- Migrations are applied to staging/prod automatically by CI on merge (`migrate` job).

## Steps

1. `npm run db:migrate $ARGUMENTS` → creates `supabase/migrations/<timestamp>_<name>.sql`.
2. Write the SQL. Read the existing migration first and match its style (lowercase SQL, comments on non-obvious columns, GIN index for array columns you'll filter on).
3. If the change needs sample data for local dev, update `supabase/seed.sql` (keep `on conflict do nothing`).
4. Prove it: `npm run db:reset`. It must apply every migration and the seed with no errors. Fix and re-run until clean.
5. Update code that depends on it (`/new-endpoint`, `CARD_FIELDS`, etc.) in the same branch.
6. In the PR body, list the migration file under *DB changes* so reviewers know CI will migrate on merge.
