// Who may merge into staging and main. Run by .github/workflows/merge-gate.yml as the
// required `merge-gate` check (repo rulesets on staging + main make it blocking).
//
// - Into main: only from this repo's own `staging` branch.
// - PR opened by a maintainer: passes.
// - Anyone else: a maintainer must approve the PR's latest commit, and no maintainer
//   may have changes requested.

const MAINTAINERS = ['ClaraVendora', 'chuakailing2608']

const isMaintainer = (login) =>
  MAINTAINERS.some((m) => m.toLowerCase() === String(login).toLowerCase())

function evaluate({ pr, reviews, repo }) {
  if (pr.base.ref === 'main' && !(pr.head.ref === 'staging' && pr.head.repo?.full_name === repo)) {
    return { ok: false, reason: `PRs into main must come from ${repo}'s staging branch. Open this PR against staging instead.` }
  }

  if (isMaintainer(pr.user.login)) {
    return { ok: true, reason: `Opened by maintainer @${pr.user.login}.` }
  }

  // Latest decision per maintainer (reviews arrive oldest first; COMMENTED doesn't change a decision).
  const latest = new Map()
  for (const r of reviews) {
    if (r.user && isMaintainer(r.user.login) && ['APPROVED', 'CHANGES_REQUESTED', 'DISMISSED'].includes(r.state)) {
      latest.set(r.user.login.toLowerCase(), r)
    }
  }
  const decisions = [...latest.values()]

  const blocker = decisions.find((r) => r.state === 'CHANGES_REQUESTED')
  if (blocker) {
    return { ok: false, reason: `@${blocker.user.login} requested changes.` }
  }

  const approval = decisions.find((r) => r.state === 'APPROVED' && r.commit_id === pr.head.sha)
  if (approval) {
    return { ok: true, reason: `Approved by maintainer @${approval.user.login}.` }
  }

  const who = MAINTAINERS.map((m) => `@${m}`).join(' or ')
  const stale = decisions.some((r) => r.state === 'APPROVED')
  return {
    ok: false,
    reason: stale
      ? `New commits since the last approval. ${who} must approve the latest commit.`
      : `Needs an approving review from ${who}.`,
  }
}

module.exports = { MAINTAINERS, evaluate }
