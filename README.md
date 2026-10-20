# sgnotboring — Singapore Discovery Hub

A centralized discovery hub for young Singaporeans: high-confidence, AI-curated
details for local food and experiences, so you don't have to cross-reference five apps.

**Stack:** pure JavaScript (no TypeScript) · Turborepo + npm workspaces ·
React + Vite + Chakra UI (`apps/web`, port 3000) · Fastify (`apps/api`, port 3001) ·
Supabase (Postgres + Auth) · Docker · Railway.

---

## 1. Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node | 22 | `node -v` (Vite 8 needs 20.19+; `.node-version` pins 22) |
| npm | 10+ | ships with Node |
| Docker Desktop | any recent | needed for containers **and** for local Supabase |

## 2. First-time setup

```bash
git clone <repo-url> sgnotboring && cd sgnotboring
npm install                              # installs all workspaces + turbo + supabase CLI
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
npm run db:start                         # boots local Supabase in Docker (first run pulls images, ~2-3 min)
```

`npm run db:start` prints your local keys. Paste them into the two `.env` files:

| Printed by `db:start` | Put it in |
|---|---|
| `API URL` (http://127.0.0.1:54321) | `SUPABASE_URL` (api) and `VITE_SUPABASE_URL` (web) |
| `anon key` | `SUPABASE_ANON_KEY` (api) and `VITE_SUPABASE_ANON_KEY` (web) |
| `service_role key` | `SUPABASE_SERVICE_ROLE_KEY` (api only, never the browser) |

Run `npm run db:status` any time to see them again. Studio (DB GUI) is at http://127.0.0.1:54323.

For the Ask tab, also set `GEMINI_API_KEY` in `apps/api/.env` (free key from
[Google AI Studio](https://aistudio.google.com/apikey)), then tag the seed places once:

```bash
npm run enrich -w api    # LLM-tags every pending place (~7 Gemini calls for the seed data)
```

`npm run db:reset` wipes the tags, so re-run `enrich` after a reset.

## 3. Running locally

### Option A — plain Node (fastest feedback loop)

```bash
npm run dev            # both apps via turbo
npm run dev:api        # only the API  → http://localhost:3001/health
npm run dev:web        # only the web  → http://localhost:3000
```

### Option B — Docker containers (matches production images)

```bash
npm run docker:up      # = docker compose up --build  (api + web, hot reload)
npm run docker:down
```

Source folders are bind-mounted so edits hot-reload inside the containers.
Re-run with `--build` after changing any `package.json`.
Inside the containers the API reaches Supabase at `host.docker.internal:54321`
(already set in `docker-compose.yml`); the browser still uses `localhost`.

### Local Supabase

```bash
npm run db:start       # start (Postgres, Auth, Studio, …)
npm run db:stop        # stop
npm run db:status      # show URLs + keys
npm run db:reset       # drop, re-run all migrations, re-run seed.sql
npm run db:migrate <name>   # create supabase/migrations/<ts>_<name>.sql
```

- Schema lives in `supabase/migrations/` — **every DB change is a migration**, never a manual edit in Studio.
- `supabase/seed.sql` loads sample places for local dev only.
- Hosted projects get migrations from CI on merge (see §5). `npm run db:push:staging` / `db:push:prod` is the manual fallback.

### All commands

| Command | What it does |
|---|---|
| `npm run dev` | api + web with hot reload |
| `npm run build` | production build of every workspace |
| `npm run lint` | oxlint on the web app |
| `npm run docker:up` / `docker:down` | local containers |
| `npm run db:*` | local Supabase (see above) |
| `npm run enrich -w api` | LLM-tag pending places (`-- --retag` re-tags all, `-- --dry-run` writes nothing) |
| `npm run db:push:staging` / `db:push:prod` | apply migrations to a hosted project |

---

## 4. Branches & deployment

```
feature/*  ──PR──▶  staging  ──PR──▶  main
                       │                 │
                       ▼                 ▼
               Railway "staging"   Railway "production"
```

**Rules** (GitHub rulesets on `staging` and `main` enforce these)

1. **No direct pushes, force pushes or deletions** on `staging` or `main`. Everything goes through a PR.
2. Feature / fix branches open PRs **against `staging`** only.
3. `main` accepts **exactly one kind of PR: `staging` → `main`**.
4. **Maintainers are @ClaraVendora and @chuakailing2608.** The required `merge-gate` check passes only when a
   maintainer opened the PR, or a maintainer approved its latest commit (new commits need a fresh approval).
   Changes under `.github/` also need a maintainer's code-owner review.
   Rules: `.github/scripts/merge-gate.cjs`; owners: `.github/CODEOWNERS`.
5. Merging to `staging` auto-deploys the Railway *staging* environment. Merging to `main` auto-deploys *production*.
6. Hotfixes follow the same path: branch → `staging` → `main`. No exceptions.

---

## 5. Environments

| | Branch | Web | API | Supabase project |
|---|---|---|---|---|
| **local** | any | http://localhost:3000 | http://localhost:3001 | CLI in Docker (`npm run db:start`) |
| **staging** | `staging` | Railway → `staging` env → `web` | Railway → `staging` env → `api` | `sg-not-boring-staging` (`pyaqltngppzgcodojita`) |
| **production** | `main` | https://web-production-543a7.up.railway.app | https://api-production-71f5.up.railway.app | `sg-not-boring` (`pnzjujwgvycdriwomwew`) |

Both apps deploy to Railway as Docker images built from the repo root; each app's `railway.json`
sets its Dockerfile, `/health` check, and rebuild watch paths. Railway's generated domains are used, no custom domain.

**Variables** live in Railway per service and per environment:

- `api`: `PORT`, `WEB_ORIGIN`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
  `GEMINI_API_KEY`, `GEMINI_MODEL` (Gemini free-tier quota is per Google Cloud project, so give each
  environment its own AI Studio project and key)
- `web`: `PORT`, `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

**Gotchas**

- `VITE_*` values are baked in at **build** time. After changing one, redeploy `web`.
- `WEB_ORIGIN` and `VITE_API_URL` reference the other service's domain (`${{web.RAILWAY_PUBLIC_DOMAIN}}` / `${{api.RAILWAY_PUBLIC_DOMAIN}}`).
  If the web page reports a CORS error after a fresh setup, redeploy `api` so the reference re-resolves.
- Adding a new env var: put it in `.env.example`, then in Railway for **both** environments.
- Migrations are applied **automatically by CI** on every push to `staging` / `main` (the `migrate` job,
  after `build` passes). Its secrets, `SUPABASE_ACCESS_TOKEN` and `SUPABASE_DB_PASSWORD`, live in the GitHub
  Environments `staging` and `production`, which only the `staging` and `main` branches can use.
  `npm run db:push:*` remains as a manual fallback.
- Migrations are forward-only. Test with `npm run db:reset` locally, let them soak on staging, and keep them
  additive (add now, drop later) since Railway deploys the app in parallel with the migration.

## 6. Repo layout

```
apps/
  api/                  Fastify backend
    src/routes/         health.js, places.js (GET /places, /places/:id, /tags), ask.js (POST /ask), me.js (GET /me)
    src/services/       supabase.js, auth.js (verified user), llm.js (Gemini), tags.js (tag vocabulary)
    src/hooks/          require-user.js (protected endpoint pre-handler)
    src/prompts/        LLM system prompts + JSON schemas (tagging, /ask interpret + rank)
    src/scripts/        enrich.js (LLM tagging job)
    src/server.js       entry point
    Dockerfile          dev + prod stages
    railway.json
  web/                  React + Vite + Chakra UI
    src/App.jsx         routes: / · /ask · /profile · /auth/callback · /places/:id · * + bottom tab bar
    src/pages/          Home (tag filter via ?tags=), Ask (chat search), Profile, PlaceDetail, NotFound
    src/components/     BottomNav, TagFilter, PlaceCard, ChatBubble, AskComposer
    src/lib/            api.js (API client), hours.js (open/closed from Google hours)
    Dockerfile          dev + build + nginx prod stages
    nginx/              SPA config, listens on $PORT
    railway.json
supabase/
  config.toml           local Supabase config
  migrations/           schema (places, tags vocabulary, raw_places + normalize trigger, search_places())
  seed.sql              local sample data: 64 places into raw_places
docker-compose.yml      local dev containers
turbo.json              dev / build / lint pipelines
.github/workflows/ci.yml   build check, DB migrate on merge
.github/workflows/merge-gate.yml   who may merge into staging/main (rules in .github/scripts/merge-gate.cjs)
```

## 7. Routing

Client-side only (React Router). nginx (prod) and Vite (dev) return `index.html` for every path;
the router picks the screen in the browser.

| Route | Screen | Notes |
|---|---|---|
| `/` | Home (Discover tab) | landing + card grid. Selected tags live in `?tags=Late%20Night,Spicy` so filtered views are shareable and the back button works |
| `/ask` | Ask (Ask tab) | chat search: "cheap supper in Bugis for 6" → top 3 places with a reason each. Conversation is component state, not URL |
| `/profile` | Account | email/password signup, login, verified name/email and logout; Supabase persists sessions across refreshes |
| `/auth/callback` | Email confirmation | processes the Supabase confirmation response and replaces the URL with `/profile` |
| `/places/:id` | PlaceDetail | one place |
| `*` | NotFound | |

Tag filtering matches places that have **any** of the selected tags (`overlaps` in `routes/places.js`; change to `contains` for all-of).

### Accounts (SGN-013) and Auth settings (ENG-03)

See [Auth setup and acceptance checks](docs/auth-setup.md). Email confirmation is enabled locally;
open http://127.0.0.1:54324 to receive test messages. After changing local Auth settings, stop/start
Supabase without resetting the database. Hosted staging/production need separate Dashboard configuration.
`GET /me` verifies the Supabase JWT and returns only the current user's identity; guest discovery remains public.
Run `npm test -w api` for unit tests and `npm run test:auth:local -w api` for the opt-in local email/token workflow.

## 8. How tagging and Ask work

### Import Google Maps places

Set `SERPAPI_KEY` in `apps/api/.env` to your [SerpApi key](https://serpapi.com/manage-api-key).
The importer uses [SerpApi's Google Maps search](https://serpapi.com/google-maps-api),
not a Google Cloud Places API key. Keep this key server-side.

```bash
npm run ingest -w api -- --query "food places in Singapore" --limit 20
# Other searches: --query "cafes in Bugis" or --query "things to do in Sentosa"
# Larger import across categories, capped at six requests total:
npm run ingest -w api -- --query "hawker food in Singapore" --query "restaurants in Singapore" --query "cafes in Singapore" --limit 120 --max-requests 6
# Preview without database writes (still uses SerpApi search credits):
npm run ingest -w api -- --query "cafes in Bugis" --limit 5 --dry-run
```

The default target is 20 unique Singapore places. Increase `--limit` (up to 1200)
and repeat `--query` for broader coverage by category or neighbourhood. Queries are
paged in turn, up to six pages per query. `--max-requests` caps the total number of
SerpApi requests across all queries (default 6, maximum 60); each uncached request
can use a search credit. The importer also stops at the target count, exhausted results
or repeated pages, so the requested count is an upper bound. Completed pages are
saved immediately, including when a later request fails or runs out of quota.
It writes the common Places payload format into `raw_places`; the existing trigger updates
`places`, so refresh the home page to display names, addresses, ratings and review counts.
Details show a Google Maps link and weekly opening hours when supplied. Text price ranges
are not converted into dollar tiers, and an old open/closed snapshot is not shown as live status.
Repeated imports update the same place IDs and preserve existing AI tags and summaries.
On an existing local database, apply pending repository migrations first with
`npx supabase migration up --local`; no database reset is needed.

For Docker users, run this command on the host with local dependencies installed (`npm install`).
The host command uses `SUPABASE_URL=http://127.0.0.1:54321` from the API `.env`.
The API containers keep using the host gateway configured in `docker-compose.yml`.

New places display immediately without Gemini. To include them in tag filtering and Ask,
set `GEMINI_API_KEY` separately, then run `npm run enrich -w api`.

### Sharing with teammates

`docker compose up --build` starts the web app and our Fastify API. Starting them or
viewing places reads Supabase; it does **not** run the importer or call SerpApi.
Only an explicit `npm run ingest -w api` command calls SerpApi, using the key in
that person's `apps/api/.env`. The Ask feature calls Gemini separately.

Local Supabase databases are separate on each computer: imported rows are not included
in Git. Teammates can import into their own local database, or use a shared hosted
Supabase database to see the same saved places. With the current Docker Compose config,
`SUPABASE_URL` is explicitly overridden to local Supabase, so switching to a hosted
database also requires updating that override. `.env` files are ignored by Git;
teammates must configure their own environment files.

### Enrichment and search

```
raw_places insert ──trigger──▶ places (name, hours, price, …)      status 'pending'
npm run enrich -w api ──▶ Gemini (batches of 10) ──▶ places.tags + summary, status 'done'

POST /ask { message, history }
  1. Gemini "interpret" → must_tags (all required), want_tags (scored), count (default 3)
  2. search_places() SQL function → up to 20 candidates; loosens filters if too few
  3. Gemini "rank" → top `count` with a one-line reason each (falls back to search order on error)
```

- Tags come only from the `tags` table (65 tags in 10 facets incl. 20 areas). Both prompts pass them as a JSON
  Schema `enum`, so the model can't invent tags. Change the vocabulary with a migration, then `enrich -- --retag`.
- Budget, Late Night, Outdoor Seating and Pet Friendly are derived from Google's data in code (`prompts/tagging.js`), not by the LLM.
- Default model is `gemini-3.1-flash-lite` (free tier). Each `/ask` costs 2 calls.

## 9. Next up

1. Web: free-text search box on Home (name / summary), alongside the tag pills
