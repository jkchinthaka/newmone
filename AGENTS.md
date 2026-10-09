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

### Standard path

Requirement → feature branch → implementation → targeted tests → `qa-reviewer` → fix confirmed
findings → repeat until the latest `qa-reviewer` verdict is **PASS** → commit → push that feature
branch → open a non-draft pull request into `main` → enable GitHub auto-merge → required GitHub
Actions checks → GitHub merges into `main` only when branch protection passes → verify `origin/main`
→ fast-forward local `main`.

### Roles

- **ChatGPT:** requirements, architecture, implementation planning, prompts, acceptance criteria, and issue analysis.
- **Cursor:** implementation, local validation, commits, feature-branch push, and pull-request creation.
- **`qa-reviewer` / Claude:** independent review of business correctness, security, RBAC, data integrity, regressions, and production readiness. It does not implement the change.
- **GitHub Actions:** the final automated integration and release gate.
- **GitHub:** auto-merge only after every required protection condition is already satisfied.

### Commit, push, and merge

- **Commit:** after the latest `qa-reviewer` verdict is PASS and the relevant checks were actually run, agents may commit that verified work (and handover or ledger updates) on a non-`main` feature, fix, or chore branch without asking first. Record the real results in the handover. Run `git diff --cached --check` before each commit. Do not commit when the latest review is FAIL.
- **Push:** after that PASS commit, push only the feature branch: `git push -u origin <branch>`. **Never push directly to `main`.**
- **Pull request:** open a non-draft PR whose base is `main`. Do not open or enable auto-merge on a Draft PR.
- **Auto-merge:** enable it only with GitHub's normal auto-merge (`gh pr merge --auto`), and only when all of the following are true:
  - the latest `qa-reviewer` verdict is PASS
  - the PR is not a draft
  - `main` branch protection is enabled, including the required status checks already configured for `main`
  - the repository setting `allow_auto_merge` is already true
  - the command does not use admin override
- **If CI fails:** fix on the feature branch, re-run the affected tests, get `qa-reviewer` PASS again when the fix changes behavior, and push the feature branch again. Do not merge, rerun checks as a way to skip them, or override failing checks.
- **After GitHub merges:** `git fetch origin`, confirm `origin/main` contains the PR commit, then fast-forward local `main`. Do not recreate the merge locally.
- **Branches:** create with `git switch --no-track -c <branch>`. Never let `origin/main` become a branch's upstream.
- **Never:** push directly to `main`; force-push `main` or any branch; bypass branch protection; use an admin override to merge failed CI; auto-merge a Draft PR; merge or enable auto-merge when `qa-reviewer` is FAIL; `git reset --hard` or `git clean` over others' work; discard uncommitted changes you did not make; or pop or drop stashes you did not create.
- A user instruction in the current session that is stricter (for example "do not commit" or "do not push") always overrides this default for that session.
- If `allow_auto_merge` is false or branch protection is missing, stop after the pull request and report the missing GitHub setting. Do not merge by hand and do not turn protection off.

Required CI gates stay whatever branch protection currently requires. Do not remove or weaken those checks. As of the 2026-10-09 GitHub API read, `main` requires `validate-monorepo`, `release-validate`, `docker-build`, and `full-stack-e2e`, with strict up-to-date branches, admin enforcement, and force-push disabled. Re-read protection before relying on that list; do not edit the protection rules from an agent task unless the user asks for that settings change.

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
as upstream. Do not locally merge `feature/phase-*` branches into `main`; they inherit
unmerged `ci/jest-heap-oom` history. A pull request from those branches still has to pass the
required GitHub checks before auto-merge can complete.
