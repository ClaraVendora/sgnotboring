# Jennifer — Sprint 1 to Sprint 3

Source: SPRINT_PLAN.xlsx, Sprint Plan rows 4, 5, 8, 9, 10; By Sprint row 5.
Acceptance criteria: IS4103 Group Work — user stories (Final 2.0).
Base: staging at b001581. Branch: feat/jennifer-sprints-1-3.

| Sprint | Story | Responsibility | Implementation |
| --- | --- | --- | --- |
| 1 | SGN-001 Browse Places by Tag | Owner | Existing responsive grid retained; tagged-only, rating-sorted browse; independent URL tags/search; accessible selected pills and visible filter-load errors. |
| 1 | SGN-006 Venue Detail Page | Owner | Existing detail fields retained; distinct not-found vs other error; stale request results ignored when IDs change. UUID/404 API handling and nginx SPA fallback already present. |
| 2 | SGN-016 Live Open or Closed Status | Owner | Shared Singapore-time weekly-period calculation, no snapshot fallback, shared minute-refresh subscription on cards/detail; unknown for missing or malformed periods. |
| 2 | SGN-010 AI Search Chat Page | Support (owner: Wen Min) | Existing guest chat, prompts, conversational history and cards retained; composer now disabled during requests, matching Send. |
| 3 | SGN-002 Search by Name or Area | Owner (API support: Kai Ling) | Search input, 300 ms debounce, clear, URL state and count; API q validation (100 characters); parameterized literal name/address/area-tag search AND selected tags. |

## Local delivery

- Dependencies installed from lockfile.
- `npm run lint`: passed (0 warnings / errors).
- `npm run build`: passed; existing large-bundle warning remains.
- `git diff --check`: passed.
- Search migration applied with `supabase migration up --local`; existing data retained.
- Existing local enrichment job completed: 64 seed places processed with tags and summaries.
- API and Web rebuilt and started through Docker Compose using local Supabase.
- Browser observation during enrichment: `q=bUgIs` returned six places; adding `tags=Cafe` returned two;
  Symmetry's detail page displayed rating, price, hours, summary, address and tags.
- No automated test suite was added or run. Exhaustive edge-case and device QA remains
  for the team's acceptance review; code completion is not a claim of that review.
- Environment files are ignored by Git. Existing local configuration was reused;
  the supplied Drive folder was reachable, but its API .env download timed out.

## Integration

Apply `supabase/migrations/20261021000000_search_places.sql` before deploying the API.
It adds a named-parameter overload; Ask continues using its existing must_tags /
want_tags / max_results signature. No new environment variables are needed.
Hosted database migrations and merges remain maintainer/CI actions.

Sprint 4+ work (photos, quick filters, extended hours/actions, accounts, persistence)
is outside this assignment. The original workbook has not been edited.
