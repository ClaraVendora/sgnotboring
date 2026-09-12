---
name: new-branch
description: Start a feature/fix/chore branch off the latest staging with the project naming convention. Usage - /new-branch <feat|fix|chore> [ticket] <short description>
---

Create a working branch from up-to-date `staging`. Arguments: `$ARGUMENTS`

## Steps

1. **Refuse if dirty.** Run `git status --porcelain`. If anything is listed, stop and tell the user to commit or stash first.
2. **Parse arguments.** First word is the type: must be `feat`, `fix`, or `chore` (ask if missing). If the next token is a number it's the ticket. The rest is the description.
3. **Build the name:** `<type>/<ticket>-<description>` or `<type>/<description>`. Description: lowercase kebab-case, 2–5 words, no stop words. Examples: `feat/42-tag-search`, `fix/cors-origin`, `chore/bump-vite`.
4. **Sync staging:**
   ```bash
   git fetch origin && git checkout staging && git pull --ff-only origin staging
   ```
   If the fast-forward fails, stop and report; never rebase or merge staging automatically.
5. **Create the branch:** `git checkout -b <name>`.
6. Report the branch name and remind: commits use `feat:|fix:|chore:` subjects; finish with `/pr`.
