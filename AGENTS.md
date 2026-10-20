# AGENTS.md

This repo's instructions for coding agents (Cursor, Codex, Copilot, Gemini, Claude, …) live in
[CLAUDE.md](CLAUDE.md). Read it in full before changing anything; it applies to every agent, not just Claude.
Task recipes are in `.claude/skills/*/SKILL.md` (new branch, page, component, endpoint, migration, PR).

Hard stops, in case you read nothing else:

- Branch off `staging` and open PRs into `staging`. Never push to `main`.
- Database changes are migrations in `supabase/migrations/`, tested against local Supabase only
  (`npm run db:start` / `npm run db:reset`). Never run `npm run db:push:*` or link a hosted Supabase project.
- Pure JavaScript only: no `.ts`/`.tsx` files or TypeScript tooling.
