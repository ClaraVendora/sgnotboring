## What

<!-- one or two lines -->

## Checklist

- [ ] Target branch is `staging` (only `staging` → `main` PRs are allowed)
- [ ] `npm run build` passes locally
- [ ] New env vars added to `.env.example` **and** to Railway (staging + production)
- [ ] DB changes are a migration under `supabase/migrations/`
