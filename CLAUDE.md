# sgnotboring

Singapore Discovery Hub: AI-curated food & experiences for young Singaporeans. Monorepo:
`apps/web` (React + Vite + Chakra UI v3, port 3000) and four Fastify microservices behind `apps/gateway`
(port 3001), Supabase Postgres with one schema per service.
See README.md for setup and environments.

## Hard constraints

- **Pure JavaScript.** Never create `.ts`/`.tsx` files or add TypeScript tooling.
- **Chakra UI v3 syntax**: namespaced parts (`Card.Root`, `Card.Body`), `colorPalette` not `colorScheme`,
  `gap` not `spacing`, `asChild` for composing with router links. Docs: chakra-ui.com/docs.
- **Node 22.** `.node-version` pins it.
- **Validation** is Fastify JSON Schema on the route (`schema: { querystring, params, body }`). No Zod.
- **DB schema changes are migrations only** (`npm run db:migrate <name>`), never edits in Studio.

## Commands

```
npm run dev           # api + web, hot reload (needs `npm run db:start` once)
npm run lint          # oxlint (web)
npm run build         # must pass before any PR
npm run db:start | db:reset | db:status
npm run docker:up     # api + web in containers
```

## Branching (never violate)

- Branch off `staging`: `feat|fix|chore/<ticket-><short-kebab-description>` (ticket number optional, e.g. `feat/42-tag-search`, `fix/cors-origin`).
- PRs go **into `staging`**. `main` only ever receives `staging → main` PRs. Never push to `main`.
- Only maintainers (@ClaraVendora, @chuakailing2608) decide merges: the required `merge-gate` check fails until
  a maintainer opened the PR or approved its latest commit. Don't try to make it pass by editing `.github/`.
- Commit subjects: `feat: …`, `fix: …`, `chore: …` — imperative, under 72 chars.
- Merge to `staging` deploys Railway staging + runs migrations; `staging → main` does the same for production.

Skills: `/new-branch`, `/pr`, `/new-page`, `/new-component`, `/new-endpoint`, `/new-migration`.

## Where things live

```
apps/web/src/
  App.jsx          route table (BrowserRouter). Every page is registered here.
  pages/           one file per route, PascalCase (Home.jsx, PlaceDetail.jsx). Owns data fetching
                   + URL state (useSearchParams/useParams), composes components. Nothing else fetches.
  components/      reusable, presentational. Props in, JSX out. No fetch, no router state.
                   One file per component; grows into components/<Name>/index.jsx if it needs subparts.
  hooks/           custom hooks (useThing.js) — create once a fetch/effect pattern repeats in 2 pages.
  lib/api.js       the ONLY place fetch() is called. One exported function per endpoint.
  lib/*.js         pure helpers (hours.js). No React imports.

apps/gateway/src/
  routes.js        path → owning service. A new public route needs a rule here. CORS lives here only.
apps/<service>/src/        places (catalog schema), ask (no tables), accounts (accounts), community (community)
  server.js        startService() from service-kit + plugin registration. Add new route files here.
  routes/<resource>.js   one Fastify plugin per resource. Thin handlers: validate via
                   schema → call service → shape response. Errors: `reply.code(n).send({ error })`.
  routes/internal.js     service-to-service endpoints under /internal/* (the gateway never forwards them).
  services/        data access + outside-world clients. No Fastify objects, so scripts can import them.
  clients.js       HTTP clients for other services (createServiceClient). Never query another schema.
  prompts/         LLM system prompts + JSON schemas, pure functions (places: tagging.js; ask: ask.js).
  scripts/         places only: `node src/scripts/<name>.js` (ingest.js = SerpApi import, enrich.js = LLM tagging).
packages/service-kit/   db.js (createDb(schema)), auth.js (token check + require/optional user preHandlers),
                   llm.js (Gemini), client.js (service-to-service HTTP), server.js, vocabulary.js.
packages/shared/   hours logic shared by web and services.

supabase/migrations/   schema, forward-only, additive (add now, drop in a later PR).
supabase/seed.sql      local sample data only.
```

## Definition of done

1. `npm run lint && npm run build` pass.
2. Tested locally against `npm run db:start` (curl for endpoints, browser for pages).
3. New env vars: added to the app's `.env.example`, and called out in the PR for Railway (both envs).
4. New endpoint → `lib/api.js` updated; new page → route in `App.jsx`; new schema → migration + `db:reset` clean.
5. README updated if commands, routes, or environments changed.

## Gotchas

- `VITE_*` values are baked at build time; changing one in Railway needs a `web` redeploy.
- `WEB_ORIGIN` (api) must exactly equal the browser's origin, no trailing slash.
- Tag filter is any-of (`overlaps`). `contains` would make it all-of.
- `opening_hours` is raw Google JSON; `lib/hours.js` derives open/closed from `periods` in SG time.
- Data flows `catalog.raw_places` → (trigger) → `catalog.places`. Write raw payloads, never normalized columns, directly.
- A service's Supabase client is pinned to its own schema (`createDb('<schema>')`). Need another service's data?
  Call its `/internal/*` endpoint through `clients.js`. No foreign keys across schemas.
- Hosted Supabase must list `catalog`, `accounts`, `community` under Data API → Exposed schemas (a new schema too).
- Tags must exist in the `tags` table (vocabulary changes are migrations). LLM output is enum-constrained to it.
- Gemini free-tier quota is per Google Cloud project: separate AI Studio project/key per environment.
