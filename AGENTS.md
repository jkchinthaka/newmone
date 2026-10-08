# Agent instructions (Cursor, Claude, Codex, and other AI agents)

Project guidance lives in [`CLAUDE.md`](CLAUDE.md). Its **Session continuity** section is mandatory
for every agent:

1. Before changing anything, read `maintainpro/docs/AI_SESSION_HANDOVER.md`, then
   `maintainpro/docs/PRODUCT_FINALIZATION_LEDGER.md`, and run the Git checks listed in the handover.
   If the branch or HEAD differs from what the handover records, stop and tell the user.
2. After every meaningful milestone, update `AI_SESSION_HANDOVER.md` (status, branch and SHA,
   changed files, tests actually run and their results, blockers, exact next action) and commit it
   on the working branch.
3. Follow the Git policy below. Never write secrets into these files.

## Git policy (single source of truth)

This section is the only authoritative rule for commit, push, and merge behavior. `CLAUDE.md`,
`.cursor/rules/*.mdc`, and other agent instructions refer here and must not restate it differently.

- **Commit:** agents may commit verified work (and handover/ledger updates) on non-`main` feature,
  fix, or chore branches without asking first. "Verified" means the relevant checks were actually
  run and their real results are recorded in the handover. Run `git diff --cached --check` before
  each commit.
- **Push:** agents must **not push any branch** without explicit user approval given for that push.
  When approved, push only the named non-`main` branch, explicitly:
  `git push -u origin <branch>`. **Never push directly to `main`.**
- **Merge:** **never merge into `main`** (locally, via `gh pr merge`, or through the GitHub UI)
  without explicit user approval given for that specific merge. Opening a PR is allowed; merging it
  is not.
- **Branches:** create with `git switch --no-track -c <branch>`. Never let `origin/main` become a
  branch's upstream.
- **Never:** force-push, `git reset --hard` or `git clean` over others' work, discard uncommitted
  changes you did not make, or pop/drop stashes you did not create.
- A user instruction in the current session that is stricter (for example "do not commit") always
  overrides this default for that session.

## Continuous local execution

As of 2026-09-29 the product owner authorized autonomous local development through the
15-phase roadmap. After reading the handover and confirming Git matches it, continue the
unfinished phase, validate it, update these tracking files, commit the verified work on the
feature branch, and start the next unfinished phase. Do not wait for a typed CONTINUE between
pages or phases.

Stop only for a real blocker: destructive data changes, production credentials, permission
widening, force-push, merging into `main` while required gates are failing, production
deployment, or an unresolved business-policy decision. Hosting failures (Vercel, Cloudflare,
Netlify, MinIO) stay on the release backlog and do not stop local phase work.

Create new phase branches with `git switch --no-track -c <branch>`. Do not set `origin/main`
as upstream. Do not merge `feature/phase-*` branches straight into `main`; they inherit
unmerged `ci/jest-heap-oom` history.
