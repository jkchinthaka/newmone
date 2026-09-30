# Agent instructions (Cursor, Claude, Codex, and other AI agents)

Project guidance lives in [`CLAUDE.md`](CLAUDE.md). Its **Session continuity** section is mandatory
for every agent:

1. Before changing anything, read `maintainpro/docs/AI_SESSION_HANDOVER.md`, then
   `maintainpro/docs/PRODUCT_FINALIZATION_LEDGER.md`, and run the Git checks listed in the handover.
   If the branch or HEAD differs from what the handover records, stop and tell the user.
2. After every meaningful milestone, update `AI_SESSION_HANDOVER.md` (status, branch and SHA,
   changed files, tests actually run and their results, blockers, exact next action) and commit it
   on the working branch.
3. Never force-push, reset or discard others' work, pop stashes you did not create, or push
   unvalidated code to `main`. Never write secrets into these files.

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
