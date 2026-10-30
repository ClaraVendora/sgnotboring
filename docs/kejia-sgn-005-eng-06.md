# SGN-005 / ENG-06: desktop layout and Account polish

## Scope and baseline

The supplied `SPRINT_PLAN.xlsx`, `Sprint Plan` rows 20 and 29, assigns both
items to Kejia in Sprint 5 (30 Oct–6 Nov). SGN-005 has Jennifer supporting the
Home grid. This change starts from the latest `staging` fetched on 30 October,
`c929028` (PR #11), on `feat/sgn-005-eng-06-desktop-account`.

SGN-005 acceptance comes from the [final user stories](https://docs.google.com/document/d/1GfQMeAonMqBRjHTSv1gvjLIEEBo1pa_nxYe9Uc25DVw/edit?tab=t.ryupfw6puehs):
top navigation from `md`, mobile bottom tabs, active states in both, a Home grid,
centred Ask/Account columns, no desktop bottom-bar spacing, and checks at
375px, 768px and 1280px.

ENG-06 follows the wireframe 09 screen structure specified in the plan and
SGN-013/014/015: profile, preferences, compact saved list and Log out. The plan
does not embed the wireframe image; styling follows the existing project UI.

## Changes

- `NavigationLinks` supplies the same destinations and accessible active marker
  to desktop and mobile navigation. Only the appropriate bar is displayed or
  reachable by keyboard. Account remains active during onboarding and callbacks.
- `AppLayout` owns `--bottom-nav-space`: mobile bar plus safe-area inset below
  `md`, zero at/above `md`. Page padding, Ask height/composer/scroll target and
  floating save feedback all follow this value without JavaScript resize state.
- Home retains the existing responsive grid. Ask retains its column, chat state
  and composer behavior. Account has a centred `2xl` container for readable
  profile information and compact cards on desktop.
- Presentational `AccountProfileCard` and `PreferencesCard` keep fetching in
  Profile/hooks. Profile names and emails wrap; missing names use the same
  fallback for the heading and avatar.
- Account shows profile → preferences → saved list → Log out. It includes a
  semantic list, accessible section headings, count, empty-state browse action,
  skeleton loading and independent retry controls. Loading/errors do not claim
  that the user has zero saved places. Save feedback appears inside that section.
- Logout has a pending label and duplicate-submit guard. Its outcome lives in
  `SessionProvider`, above the account remount boundary. A successful logout
  displays confirmation on the guest screen; if the SDK clears local auth but
  returns a server error, the guest screen explains the partial outcome.

## Validation

The local Supabase database was started with existing data; no reset or hosted
database changes were needed. Tests create and remove their own local users.

- `npm run lint`: passed with zero warnings/errors.
- `npm run build`: passed; the existing non-blocking bundle-size advisory remains.
- `npm test -w api`: 35 passed, 2 opt-in integration tests skipped.
- `npm test -w @sgnotboring/shared`: 6 passed.
- `npm run test:auth:local -w api`: 5 passed against real local Auth.
- `npm run test:personalisation:local -w api`: 7 passed including direct RLS.
- `desktop-account.spec.js`: all 7 new browser workflows passed.
- Full Chromium E2E suite: all 24 passed, including existing Ask recovery,
  history/scroll preservation, personalisation, signup, token refresh and saves.

The new browser suite checks each target width, mobile/desktop navigation and
keyboard routing, Home columns, composer position, no horizontal overflow,
retention of chat/draft through resizing, and Account profile/preference/list
alignment. It exercises Edit/Skip, individual unsaves through the real API,
empty state, logout, loading, section failures/retries and failed server logout.
Screenshots at all three widths were inspected.

Run with local services and `.env` configured:

```sh
npm run test:e2e:local -w web -- desktop-account.spec.js
npm run test:e2e:local -w web
```

Browser tests use Chromium. Ask responses are stubbed to avoid Gemini charges;
account/login/preferences/saves use the real local services. Live Gemini quality
and hosted deployment are outside this UI change.

## Handoff

No new packages, API routes, database migrations or environment variables.
PR target is `staging`; maintainers retain merge/deploy control. The uploaded
plan is read-only and has not been modified.
