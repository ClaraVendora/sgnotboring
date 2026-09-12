---
name: new-endpoint
description: Add a Fastify endpoint in apps/api with JSON-schema validation, service call, error shape, registration, web API client update, and a curl check. Usage - /new-endpoint <METHOD> <path> [purpose]
---

Add an endpoint: `$ARGUMENTS` (e.g. `GET /places/nearby` or `POST /places`).

## Rules (from CLAUDE.md)

- One Fastify plugin per resource in `apps/api/src/routes/<resource>.js` (the first path segment is the resource). Extend the existing file if it exists; otherwise create it and register in `server.js` with `await app.register(...)`.
- **Validate with Fastify JSON Schema** on the route (`schema: { querystring | params | body }`, `additionalProperties: false`). No Zod. Invalid values → automatic 400 (`FST_ERR_VALIDATION`); unknown properties are silently stripped, not rejected.
- Handlers are thin: read validated input → call a `services/` function or the Supabase client → return data. Errors: `reply.code(500).send({ error: error.message })`, not-found: `reply.code(404).send({ error: '...' })`. Match `routes/places.js` exactly.
- Anything that talks to Google/LLM/other APIs is a function in `services/<name>.js` with **no Fastify objects**, so `scripts/` can reuse it.
- Reads use the Supabase client as-is (service role server-side). Writes must only happen from the API/scripts, never the browser.

## Steps

1. Read `apps/api/src/routes/places.js` and `server.js`. Mirror their shape.
2. If the endpoint needs a new column/table → run `/new-migration` first.
3. Write the route with its schema. Select only the fields the client needs (see `CARD_FIELDS`).
4. Register the plugin in `server.js` if it's a new file.
5. Add a matching function to `apps/web/src/lib/api.js` (one export per endpoint, encode query params with `encodeURIComponent`).
6. Verify against local Supabase (`npm run db:start`, `npm run dev:api`):
   ```bash
   curl -s localhost:3001/<path> | head -c 300          # happy path
   curl -s -w ' [%{http_code}]' localhost:3001/<bad>    # 400 / 404 paths
   ```
7. If it needs a new env var: add to `apps/api/.env.example` and say so in the PR (Railway, both envs).
8. Update the README layout line for `routes/` if a new resource file was added.
