---
name: pr
description: Verify, push the current feature branch, and open a pull request into staging (never main). Usage - /pr [optional title]
---

Open a PR for the current branch into `staging`. Optional title override: `$ARGUMENTS`

## Steps

1. **Check the branch.** `git branch --show-current`. If it is `staging` or `main`, stop: PRs are opened from feature branches only. `staging → main` PRs are opened manually by a maintainer.
2. **Check for uncommitted work.** If `git status --porcelain` is non-empty, ask whether to commit it (subject must start with `feat:`, `fix:`, or `chore:`) or stop.
3. **Verify:** `npm run lint && npm run build`. Both must pass; fix and re-run rather than opening a red PR.
4. **Sync check:** `git fetch origin`; if `origin/staging` has commits not in this branch, `git merge origin/staging` and resolve, then re-run step 3.
5. **Push:** `git push -u origin HEAD`.
6. **Title:** use `$ARGUMENTS` if given, else derive from the branch: `feat/42-tag-search` → `feat: tag search (#42)`.
7. **Body:** fill `.github/pull_request_template.md`. Under *What*, 1–3 lines from the commits. Tick checklist items that are actually true. List any new env vars that must be added to Railway (both environments) and any migration files.
8. **Create:** `gh pr create --base staging --title "<title>" --body-file <tmp>`. Never `--base main`.
9. Report the PR URL and which CI checks will run (`build`, and `migrate` after merge if migrations changed).
