# 01 Project baseline

Recorded 2026-10-15 from Git, not from the older handover text.

## Checkouts

| Tree | Branch | HEAD | Notes |
| --- | --- | --- | --- |
| `C:\Users\chint\OneDrive\Pictures\newmone` | `fix/ux-confirmed-defects` | `99ec9d5b` | Tracks origin. Untracked: `backup_maintain pro/`, `maintainpro/.github/renovate.json`. |
| Release worktree | `fix/enterprise-remediation-20261015` | `a79859dc` | Created with `git switch --no-track -c` from `release/maintainpro-final-consolidation-20261013`. Uncommitted product work was kept. |
| Other worktrees | various | `4d394657` | integration-rehearsal, perf-navigation, pilot-readiness, request-review-terminology, detached `mp-ux-build`. Not edited. |

`git merge-base a79859dc 99ec9d5b` is `4d394657`. The previously audited SHA and the UX commit are ancestors of different lines. The OneDrive handover still says HEAD `4d394657`. Actual OneDrive HEAD is `99ec9d5b` (`Fix confirmed UX defects in queues, tables, and responsive layouts.`).

## Canonical choice for this remediation

The release worktree is the code under change. It already contains the uncommitted consolidation (work-order lifecycle, requester lookup, stock helpers). The UX branch was not merged. A blind merge of that commit into this dirty tree is unsafe.

## Running servers observed earlier this session

- Port 3000: OneDrive API process, database `MaintainProDev`. Not used for remediation mutations.
- Port 3001: OneDrive Next (`next dev -p 3001`). Not release evidence.
- Port 3023: release worktree Next. Its dev API default is `http://localhost:3000/api`.
- Port 3011: not listening at the last check.

No commit, push, or merge was made.
