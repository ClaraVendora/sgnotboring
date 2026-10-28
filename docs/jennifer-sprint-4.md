# Jennifer — Sprint 4 (23–29 Oct)

Source: Copy of SPRINT_PLAN.xlsx, By Sprint E5 and Sprint Plan rows 14, 15, 18;
user stories Final 2.0, SGN-003 / SGN-004 / SGN-018. Tutorial 7 work log was read
before implementation. Base staging: 23a4778 (PRs #7 and #8 merged); PR #9 (Kejia's
survey/saved places) was open at implementation time.

## Delivered

- SGN-003: exactly five quick filters; one label-to-tag mapping; full tag list behind
  More filters; URL-persistent open_now/tags/q; current result count; shared live
  Singapore-time filter, excluding unknown hours; independent clears.
- SGN-004: photo-first card and 64 px compact card; assigned area tag, price band,
  abbreviated review count, OPEN/CLOSED/unknown badge, at most three tags;
  lazy photos with neutral missing/broken fallback; one detail link per card.
- SGN-018 support: extracted the existing hours calculator into an npm workspace
  used by both web and API. Wired the same calculation into AI candidate filtering
  before ranking, with current-time phrase handling and no-open-match guidance.
- The optional save/compact interface matches PR #9. SaveButton is the identical
  presentational component from that branch; this change does not implement or
  alter its authentication, persistence, optimistic updates or RLS.

## Validation

- Shared hours + card/filter tests: 8 passed.
- API suite: 19 passed, 1 opt-in local auth integration test skipped.
- Lint: passed. Web build: passed (existing bundle-size warning remains).
- Local Docker Web/API rebuilt; staging's browse/photo migrations applied locally
  without resetting data. No new migrations or env variables in this branch.
- Real Gemini/API request: 200; 2 picks, both open at request time; photo_url present.
- Browser: 64 initial places -> 2 with Open now; Under $20 plus Al-Azhar query -> 1;
  URL refresh, back navigation, More filters and clear-search behavior checked.
- Mobile at 375 px: no document overflow. Compact thumbnails measured 64x64 with
  loading=lazy. A temporary component fixture checked successful/missing/broken
  images, three tags, heart click without navigation, and thumbnail navigation.
  That fixture was removed after validation.

## Integration notes

Saved-list persistence and the live Account saved-list screen belong to PR #9,
which is still a dependency until a maintainer merges it. Its existing callers use
`compact` and `save`, so retain those props when resolving any overlapping JSX.
SGN-019 conversation persistence remains Wen Min's separate task.
All changes are local/feature-branch work; hosted migrations and final merges are
maintainer/CI actions.
