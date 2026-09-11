# sgnotboring — Singapore Discovery Hub (MVP)

A centralized discovery hub for young Singaporeans: high-confidence, AI-curated
details for local food and experiences, so you don't have to cross-reference five apps.

## Stack

- Pure JavaScript (ES6+) — no TypeScript
- Turborepo + NPM Workspaces
- `apps/web` — React + Vite + Chakra UI (port 3000)
- `apps/api` — Fastify (port 3001)
- Supabase (PostgreSQL + Auth)

## Getting started

```bash
npm install
cp apps/web/.env.example apps/web/.env
cp apps/api/.env.example apps/api/.env
# fill in your Supabase URL + anon key in both .env files
npm run dev
```

- Web: http://localhost:3000
- API: http://localhost:3001/health

## Layout

```
apps/
  api/src/routes/     # API endpoints
  api/src/services/   # Supabase / Google Places / LLM logic
  api/src/server.js   # Fastify entry point
  web/src/components/ # Chakra UI components
  web/src/pages/      # Views (Home/Search)
  web/src/lib/        # API client / utils
  web/src/App.jsx
```

## Next up (core MVP)

1. API: ingest script — Google Places → LLM tag generation → Supabase insert
2. API: `GET /places?tags=...` querying Supabase with tag filters
3. Web: search bar + tag pills + card grid (name, rating, tags, open status)
