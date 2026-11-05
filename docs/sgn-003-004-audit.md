# SGN-003 / SGN-004 acceptance review

Reference: User Stories (Final 2.0), pages 1–2.

## SGN-003

- Exactly five quick controls; vocabulary mappings live in `lib/place-filters.js`.
- Full tag selector is behind More filters. Selected controls use solid styling and aria-pressed.
- Home now gathers matching candidate batches and filters them in the browser using the existing Singapore hours calculator. This corrects the Sprint 5 change that delegated current-time filtering to the API. All matching candidates are needed for an accurate count; ordinary browsing retains incremental loading.
- The minute clock updates the filtered set without refetching every minute. Closed and unknown hours are excluded. Shared tests cover overnight, week wrap and 24-hour schedules.
- Browser verified: Open now, Budget combination, More filters disclosure, URL refresh persistence, and name search. At review time: 49 open, 26 open Budget, one open Budget result for Nylon. Counts naturally change with Singapore time.

## SGN-004

Existing component meets the requested full and compact layouts. Ask and Account saved places both pass `compact`.

- Area uses controlled tags; metadata includes price and abbreviated review count, followed by at most three tags.
- Temporary fixture verified successful lazy-loaded image, exact 64×64 compact image, no-photo and broken-image fallbacks. Fixture removed after checking.
- Browser verified a guest heart shows login guidance without navigation; a compact card heart toggles independently; clicking its thumbnail activates the single detail overlay link.
- Local seed venues have no photo URLs. Neutral placeholders are expected; no fabricated venue photos were added.

Validation: 13 existing shared hours/card/filter tests passed; lint and production build passed. Changes remain on local `feat/jennifer-sprint-5` alongside the user's ongoing Sprint 5 work.
