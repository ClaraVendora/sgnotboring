# SGN-014 / SGN-015: taste survey and saved places

## Scope and source

Source: [User Stories (Final 2.0)](https://docs.google.com/document/d/1GfQMeAonMqBRjHTSv1gvjLIEEBo1pa_nxYe9Uc25DVw/edit?tab=t.ryupfw6puehs), retrieved 26 October 2026.

SGN-014 requires four chip questions (usual choices, budget, dietary needs, dining companions), Skip and Finish, one vocabulary-tag preference row per user with RLS, an editable My preferences account card, and migration of any missing vocabulary tags. Skip must create no preferences and must not block browsing.

SGN-015 requires optimistic save hearts on cards and details; rollback and feedback when a write fails; user-owned saved rows protected by RLS; a guest login prompt without guest saves in local storage; an account Saved places (N) list with compact cards and an empty state; and per-user `saved` flags on place list/detail responses.

The earlier `is4301-personalisation/` documents are a separate, broader proposal. This implementation follows the group's four-question scope. The personalised AI ranking toggle is SGN-012 and is outside this change.

## Implementation

- `preferences`: user primary key, canonical tags, created/updated timestamps. `saved_places`: user/place composite primary key and original save timestamp. Both cascade on parent deletion and have explicit owner RLS.
- SQL triggers reject unknown, duplicate or null preference tags even on direct PostgREST writes. Foreign keys reject saves of nonexistent places. `No pork` and `Family Friendly` extend the vocabulary.
- `/me/preferences/options`, GET/PUT `/me/preferences`, GET `/me/saved-places`, PUT/DELETE `/me/saved-places/:id`. Verified JWTs determine ownership; body/query user IDs cannot change it. Save/remove are idempotent.
- `/places`, `/places/:id` and `/ask` annotate each result with the requesting user's `saved` boolean. Missing credentials mean guest; supplied invalid credentials fail closed. Responses are not cached.
- `/onboarding` opens after email confirmation. Four optional chip groups; one usual budget, other groups allow multiple choices. Skip never writes. When editing it preserves existing preferences; Finish replaces them, including an empty selection.
- Shared session/saved state with identity isolation, per-place mutation locks, immediate optimistic updates, rollback and visible feedback. Account has My preferences, prefilled Edit and compact Saved places (N), including loading/error/retry/empty states.
- Heart buttons are separate from place links and expose `aria-pressed`, pending state and descriptive labels. Guest clicks show a login link without local persistence. Feedback remains visible when browsing a long list.
- API CORS explicitly allows PUT/DELETE for browser mutations. All frontend network calls remain in `lib/api.js`; components accept props without fetching.

## Verified locally — 26 October 2026

| Check | Result |
|---|---|
| `npm run db:reset` | All seven migrations plus seed completed from a clean local database |
| `npm run lint` | Passed, 0 errors / 0 warnings |
| `npm run build` | Passed; Vite reports its non-blocking >500 kB bundle advisory |
| `npm test -w api` | 18 passed; 2 opt-in local tests skipped in the default run |
| `npm run test:auth:local -w api` | 5 passed, including real signup, confirmation email, JWT validation, refresh and logout |
| `npm run test:personalisation:local -w api` | 6 passed, including real two-user Supabase/RLS integration |
| `npm run test:e2e:local -w web` | 4 Chromium workflows passed against real local web/API/Auth/Postgres |

Browser coverage:

1. Guest heart shows login prompt, leaves URL unchanged and local storage empty; card link still opens details.
2. Signup in the UI → local confirmation email → four-question survey. Skip creates no row. Finish persists vocabulary tags. Reload/Edit restores them. Keyboard Space selects a budget; changing it deselects the old one. Failed preference writes preserve choices and retry succeeds.
3. Save appears before the response; a rapid repeat tap cannot duplicate a request. Account count and reload agree. Failed removal restores the card/count; failed save rolls back. Unintercepted browser PUT/DELETE requests also pass, including real CORS.
4. A delayed save response from account A cannot enter account B's list after logout/login. AI result cards and Account share heart state for account B.

Direct RLS coverage: each user can access their own rows; cross-user reads return no rows;
cross-user inserts, ownership changes, updates and deletes cannot affect the owner;
guests have no grants; duplicate saves and invalid direct preference tags fail;
deleting a test user cascades to their preferences and saves. Tests clean up their users.

Survey and Account screenshots were inspected at 390px mobile width; mobile and 1280px
desktop layouts were checked for horizontal overflow. Screenshots live in ignored
`apps/web/test-results/` after the E2E run. Auth traces are deliberately disabled.

## Review and handoff

- Branch: `feat/sgn-014-015-taste-saves`, based on `staging`.
- Migration: `20261026031535_create_preferences_and_saved_places.sql`.
- No new runtime environment variables. Playwright is a development-only dependency.
- Existing local DB: `npx supabase migration up --local`; clean reset is optional and erases local data.
- Hosted migrations/deployment remain in the existing CI path after maintainer merge.
- Live Gemini output was not evaluated: the AI-card test stubs only `/ask` output while authentication, saves and persistence use the real local services. SGN-012's personalised ranking is outside this change.
- Only maintainers merge/deploy; the existing merge gate is unchanged.
