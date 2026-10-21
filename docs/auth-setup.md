# ENG-03 / SGN-013: account setup and verification

## Implementation

- `/profile`: optional account, email/password login and signup, optional display name, inline errors, resend confirmation, logout.
- `/auth/callback`: Supabase SDK consumes the confirmation URL, then replaces it with `/profile`. Invalid/expired link errors are rendered safely.
- Supabase Auth stores the account and display name (`user_metadata.display_name`). The SDK manages session storage, refresh and cross-tab changes. No custom password or profile table is required for SGN-013.
- `GET /me`: verifies the Bearer token against this project's Supabase Auth using `getUser`; returns only `id`, `email`, `display_name`. Missing, malformed, invalid or unconfirmed-user tokens return 401; Auth service failures return 503. Responses are not cacheable.
- Reuse `createRequireUser()` as a route pre-handler for future authenticated endpoints. Public place browsing and `/ask` remain available to guests.
- `signOut({ scope: 'local' })` signs out this browser session, including its other tabs. Supabase revokes refresh tokens; already issued access tokens may remain valid until expiry.
- No hosted project, migration or deployment is changed by running this feature locally.

## Local setup

Use Node 22 and the repository lockfile. Run `npm ci`, start Docker Desktop and run `npm run db:start`.
After changing `supabase/config.toml`, apply the Auth settings with `npx supabase stop` followed by `npm run db:start`. Stop preserves local database volumes; a reset is unnecessary.

`config.toml` enables email signup and confirmation, requires at least 8 password characters, and permits these exact callbacks:

- `http://localhost:3000/auth/callback`
- `http://127.0.0.1:3000/auth/callback`

Site URL: `http://localhost:3000`.
Confirmation messages arrive in local Mailpit at `http://127.0.0.1:54324`; they are not delivered to real mailboxes.
Local API `WEB_ORIGIN` must include the browser origin; the example includes both localhost and 127.0.0.1.

The existing `SUPABASE_URL` / `SUPABASE_ANON_KEY` and `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` must reference the same local project. Never put a service-role key in a `VITE_*` variable.

Run:

```bash
npm run dev
npm run lint
npm run build
npm test -w api
npm run test:auth:local -w api
```

The last command uses a temporary `@example.com` account, consumes its local confirmation email, tests token refresh and revocation, and deletes the test account/email. It refuses hosted Supabase URLs. Other tests need no running database.

## Hosted settings to apply once project access is available

ENG-03 is **not complete until both hosted projects are configured and verified**. Editing the local TOML or applying database migrations does not update hosted Auth settings.

| Setting | Staging | Production |
|---|---|---|
| Project | `sg-not-boring-staging` | `sg-not-boring` |
| Project ref | `pyaqltngppzgcodojita` | `pnzjujwgvycdriwomwew` |
| Allow new users to sign up | Enabled | Enabled |
| Email provider | Enabled | Enabled |
| Confirm email | Enabled | Enabled |
| Minimum password length | 8 | 8 |
| Site URL | `https://web-staging-678b.up.railway.app` | `https://web-production-543a7.up.railway.app` (repository value; recheck against Railway) |
| Additional redirect URL | `https://web-staging-678b.up.railway.app/auth/callback` | `https://web-production-543a7.up.railway.app/auth/callback` |

Dashboard links:

- [Staging providers](https://supabase.com/dashboard/project/pyaqltngppzgcodojita/auth/providers)
- [Staging URL configuration](https://supabase.com/dashboard/project/pyaqltngppzgcodojita/auth/url-configuration)
- [Production providers](https://supabase.com/dashboard/project/pnzjujwgvycdriwomwew/auth/providers)
- [Production URL configuration](https://supabase.com/dashboard/project/pnzjujwgvycdriwomwew/auth/url-configuration)

Use exact callback URLs. Preserve existing URLs that are still in use; do not replace the whole allowlist blindly. Password sign-in is supplied by the Email provider, not a separate OAuth provider.
The current callback uses the Supabase default confirmation-link flow; retain `{{ .ConfirmationURL }}` in the signup email template.

Check the project's email sender settings. Supabase's default sender is restricted and rate-limited; if regular non-team users cannot receive confirmation mail, a maintainer must configure an approved SMTP sender. Do not disable email confirmation to hide delivery failures.

Railway already defines the required variable names. Verify each environment uses its own project URL and anon key, and that API `WEB_ORIGIN` equals its web origin. Redeploy web if any `VITE_*` value changes.
Feature PRs target `staging`; only maintainers approve merges and promote `staging` to `main`. No direct pushes or remote database CLI links.

## Acceptance walkthrough (repeat separately for local, staging and production)

1. Browse as a guest. Account offers Log in / Sign up and explains that an account is optional.
2. Try empty email, malformed email and a short signup password: inline messages, no blank screen.
3. Register a fresh test email. See the confirmation notice; no signed-in account before confirmation.
4. Attempt login before confirmation: see the email-not-confirmed message. Resend confirmation works.
5. Follow the received email link. The browser returns to that environment's `/auth/callback`, then `/profile`, showing name/email.
6. Refresh the page and reopen Account: still signed in.
7. Open Account in two tabs. Log out in one; both return to the guest form. Refresh remains logged out.
8. Wrong password produces a useful inline message. Invalid/expired links show a recovery message. Duplicate signup either returns Supabase's duplicate error or the generic anti-enumeration confirmation notice.
9. API `/me` with no token, tampered token, expired token or anon key returns 401; the signed-in user's token returns that user's identity.
10. Simulate a network outage and retry. Browse remains usable and errors are inline.

Survey, saved places and personalisation are separate next-sprint stories; this change does not claim those features.
