# sgnotboring — Singapore Discovery Hub (MVP)

A centralized discovery hub for young Singaporeans: high-confidence, AI-curated
details for local food and experiences, so you don't have to cross-reference five apps.

**Stack:** pure JavaScript (no TypeScript) · Turborepo + npm workspaces ·
React + Vite + Chakra UI (`apps/web`, port 3000) · Fastify (`apps/api`, port 3001) ·
Supabase (Postgres + Auth) · Docker · Railway.

---

## 1. Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node | 22 (18+ works) | `node -v` |
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
- Push migrations to a hosted project with `npx supabase db push` after `npx supabase link --project-ref <ref>`.

### All commands

| Command | What it does |
|---|---|
| `npm run dev` | api + web with hot reload |
| `npm run build` | production build of every workspace |
| `npm run lint` | oxlint on the web app |
| `npm run docker:up` / `docker:down` | local containers |
| `npm run db:*` | local Supabase (see above) |

---

## 4. Branches & deployment

```
feature/*  ──PR──▶  staging  ──PR──▶  main
                       │                 │
                       ▼                 ▼
               Railway "staging"   Railway "production"
```

**Rules**

1. **Never push or merge directly to `main`.** Everything goes through a PR.
2. Feature / fix branches open PRs **against `staging`** only.
3. `main` accepts **exactly one kind of PR: `staging` → `main`**. CI (`guard-main` job) fails any other PR into `main`.
4. Merging to `staging` auto-deploys to the Railway *staging* environment. Merging to `main` auto-deploys to *production*.
5. Hotfixes follow the same path: branch → `staging` → `main`. No exceptions.

**Recommended GitHub branch protection** (Settings → Branches), for both `staging` and `main`:
require a PR, require the `CI` checks to pass, block force-pushes, and on `main` additionally
require at least 1 approval. With `gh`:

```bash
for b in main staging; do
  gh api -X PUT repos/{owner}/{repo}/branches/$b/protection \
    -f required_status_checks[strict]=true \
    -f 'required_status_checks[contexts][]=Install, lint, build' \
    -f 'required_status_checks[contexts][]=Docker images build' \
    -f enforce_admins=true \
    -f required_pull_request_reviews[required_approving_review_count]=1 \
    -F restrictions=null -F allow_force_pushes=false -F allow_deletions=false
done
```

---

## 5. Railway setup (one-time)

Both apps ship as Docker images built from the **repo root** (npm workspaces need the root lockfile).
Each app has its own `railway.json` that tells Railway which Dockerfile to use and which paths trigger a rebuild.

1. **Project & environments.** Create a Railway project. It comes with a `production` environment;
   add a second environment named `staging` (Project → Settings → Environments).

2. **Two services, from the same GitHub repo** (do this in *each* environment — duplicating the environment copies them):

   | Service | Settings → Source | Settings → Build → Config file path |
   |---|---|---|
   | `api` | this repo, root directory `/` | `apps/api/railway.json` |
   | `web` | this repo, root directory `/` | `apps/web/railway.json` |

   Leave *Root Directory* at `/`. Enable **Public Networking** on both to get a `*.up.railway.app` domain.

3. **Branch per environment.** In each service → Settings → Source → *Branch*:
   `staging` environment deploys `staging`, `production` environment deploys `main`.

4. **Variables** (per environment; the `${{...}}` are Railway reference variables):

   `api` service
   ```
   WEB_ORIGIN=https://${{web.RAILWAY_PUBLIC_DOMAIN}}
   SUPABASE_URL=https://<project-ref>.supabase.co
   SUPABASE_ANON_KEY=...
   SUPABASE_SERVICE_ROLE_KEY=...
   ```
   `web` service (these are **build-time** — Vite bakes them in; the Dockerfile declares them as `ARG`)
   ```
   VITE_API_URL=https://${{api.RAILWAY_PUBLIC_DOMAIN}}
   VITE_SUPABASE_URL=https://<project-ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=...
   ```
   `PORT` is injected by Railway automatically; both images listen on it.

5. **Supabase.** Use **two hosted Supabase projects**, one per environment (staging / prod), and point
   each Railway environment at its own. Apply migrations with `npx supabase link` + `npx supabase db push`
   (do this for staging when a PR merges to `staging`, and for prod when `staging` → `main` merges).

6. Health checks are pre-configured (`/health` on both services) so a bad deploy never replaces a good one.

---

## 6. Repo layout

```
apps/
  api/                  Fastify backend
    src/routes/         API endpoints
    src/services/       Supabase / Google Places / LLM logic
    src/server.js       entry point
    Dockerfile          dev + prod stages
    railway.json
  web/                  React + Vite + Chakra UI
    src/components/     Chakra UI components
    src/pages/          views (Home/Search)
    src/lib/            API client / utils
    Dockerfile          dev + build + nginx prod stages
    nginx/              SPA config, listens on $PORT
    railway.json
supabase/
  config.toml           local Supabase config
  migrations/           schema (places table, tags GIN index, RLS)
  seed.sql              local sample data
docker-compose.yml      local dev containers
turbo.json              dev / build / lint pipelines
.github/workflows/ci.yml   build + docker checks, main-branch guard
```

## 7. Next up (core MVP)

1. API: ingest script — Google Places → LLM tag generation → Supabase `places` insert
2. API: `GET /places?tags=...` querying Supabase with tag filters
3. Web: search bar + tag pills + card grid (name, rating, tags, open status)
