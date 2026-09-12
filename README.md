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
- Push migrations to a hosted project with `npm run db:push:staging` or `npm run db:push:prod`
  (links to the right project, then pushes; asks for the project's DB password the first time).

### All commands

| Command | What it does |
|---|---|
| `npm run dev` | api + web with hot reload |
| `npm run build` | production build of every workspace |
| `npm run lint` | oxlint on the web app |
| `npm run docker:up` / `docker:down` | local containers |
| `npm run db:*` | local Supabase (see above) |
| `npm run db:push:staging` / `db:push:prod` | apply migrations to a hosted project |

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

**Enforcement:** CI's `guard-main` job goes red on any PR into `main` that doesn't come from `staging`. Don't merge on a red check.

---

## 5. Railway setup (one-time)

Both apps ship as Docker images built from the **repo root**. Each app's `railway.json` tells Railway
which Dockerfile to use, the `/health` check, and which paths trigger a rebuild. We use Railway's
generated `*.up.railway.app` domains, no custom domain.

**A. Production environment (deploys `main`)**

1. railway.com → **New Project → Deploy from GitHub repo** → pick `ClaraVendora/sgnotboring`
   (first time: install the Railway GitHub app and grant it this repo).
2. The service it creates becomes the API. Rename it **`api`**, then in its Settings:
   - Source → Branch: `main`. Root directory: leave as `/`.
   - Build → Railway Config File: `apps/api/railway.json`.
   - Networking → **Generate Domain**. If asked for a port, enter `3001`.
3. **+ New → GitHub Repo** → same repo again. Rename it **`web`**. Same settings, but
   config file `apps/web/railway.json` and port `3000`.
4. Variables (service → Variables tab → Raw Editor is fastest). `${{...}}` are Railway references
   and resolve automatically once both domains exist.

   `api`
   ```
   PORT=3001
   WEB_ORIGIN=https://${{web.RAILWAY_PUBLIC_DOMAIN}}
   SUPABASE_URL=https://pnzjujwgvycdriwomwew.supabase.co
   SUPABASE_ANON_KEY=<prod anon key>
   SUPABASE_SERVICE_ROLE_KEY=<prod service_role key>
   ```
   `web` (build-time: Vite bakes these in, so changing them requires a redeploy)
   ```
   PORT=3000
   VITE_API_URL=https://${{api.RAILWAY_PUBLIC_DOMAIN}}
   VITE_SUPABASE_URL=https://pnzjujwgvycdriwomwew.supabase.co
   VITE_SUPABASE_ANON_KEY=<prod anon key>
   ```
   Keys come from the Supabase dashboard → Project Settings → API.
5. Deploy both (they usually auto-deploy on save). Check `https://<api-domain>/health` returns
   `{"status":"ok"}` and `https://<web-domain>` shows *API status: ok*.

**B. Staging environment (deploys `staging`)**

1. Project → Settings → **Environments → New Environment** → name `staging`, duplicate from `production`.
2. Switch to the `staging` environment (top-left switcher). For **each** service:
   - Settings → Source → Branch: `staging`.
   - Networking → Generate Domain (domains are not copied between environments).
   - Variables → swap the three Supabase values for the staging project
     (`https://pyaqltngppzgcodojita.supabase.co` + its keys). The `${{...}}` references stay as-is.
3. Redeploy both and run the same two checks.

From now on: merge to `staging` → staging URLs update; merge `staging` → `main` → production updates.

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
.github/workflows/ci.yml   build check, main-branch guard
```

## 7. Next up (core MVP)

1. API: ingest script — Google Places → LLM tag generation → Supabase `places` insert
2. API: `GET /places?tags=...` querying Supabase with tag filters
3. Web: search bar + tag pills + card grid (name, rating, tags, open status)
