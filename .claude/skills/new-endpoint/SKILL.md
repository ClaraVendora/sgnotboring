---
name: new-endpoint
description: Add a Fastify endpoint to the owning microservice (places, ask, accounts or community) with JSON-schema validation, service call, error shape, gateway routing, web API client update, and a curl check. Usage - /new-endpoint <METHOD> <path> [purpose]
---

Add an endpoint: `$ARGUMENTS` (e.g. `GET /places/nearby` or `POST /collections/:id/rename`).

## Rules (from CLAUDE.md)

- Pick the **owning service** by its data: catalogue → `apps/places`, AI search → `apps/ask`, profile/survey/saved
  places → `apps/accounts`, collections/reviews → `apps/community`. A service only queries its own schema
  (`createDb('<schema>')`); anything else comes from another service's `/internal/*` endpoint via `src/clients.js`.
- One Fastify plugin per resource in `apps/<service>/src/routes/<resource>.js`. Extend the existing file if it
  exists; otherwise create it and register it in that service's `src/server.js`.
- **Public paths need a gateway rule** in `apps/gateway/src/routes.js` (plus a case in `gateway.test.js`).
  Service-to-service endpoints go under `/internal/*` in `routes/internal.js`; the gateway never forwards them.
- **Validate with Fastify JSON Schema** on the route (`schema: { querystring | params | body }`, `additionalProperties: false`). No Zod. Invalid values → automatic 400 (`FST_ERR_VALIDATION`); unknown properties are silently stripped, not rejected.
- Handlers are thin: read validated input → call a `services/` function → return data. Errors:
  `reply.code(500).send({ error: '<safe message>' })`, not-found: `reply.code(404).send({ error: '...' })`.
  Match `apps/places/src/routes/places.js`.
- Signed-in routes use `createRequireUser()` / `createOptionalUser()` from `@sgnotboring/service-kit/auth`; every
  service verifies the token itself. Scope every query to `request.user.id` (the service role key bypasses RLS).
- Anything that talks to Google/LLM/other APIs is a function in `services/<name>.js` with **no Fastify objects**.

## Steps

1. Read the owning service's `src/routes/` and `src/server.js`. Mirror their shape.
2. If the endpoint needs a new column/table → run `/new-migration` first (in that service's schema).
3. Write the route with its schema. Select only the fields the client needs (see `CARD_FIELDS` in Places).
4. Register the plugin in `server.js` if it's a new file; add the gateway rule for a new public path.
5. Add a matching function to `apps/web/src/lib/api.js` (one export per endpoint, encode query params with `encodeURIComponent`).
6. Unit-test with `app.inject` and injected services (see `apps/places/src/routes/places.test.js`), then verify
   against local Supabase (`npm run db:start`, `npm run dev:services`), through the gateway:
   ```bash
   curl -s localhost:3001/<path> | head -c 300          # happy path
   curl -s -w ' [%{http_code}]' localhost:3001/<bad>    # 400 / 404 paths
   ```
7. If it needs a new env var: add to that service's `.env.example` and say so in the PR (Railway, both envs).
8. Update README §6 if a new resource file or service call was added.
