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
