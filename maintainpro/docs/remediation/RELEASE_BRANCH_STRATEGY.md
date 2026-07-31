# Release and Branch Strategy

**Status:** SOURCE_VALIDATED  
**Tag format (chosen):** `maintainpro-vMAJOR.MINOR.PATCH` (example: `maintainpro-v1.2.1`)  
**Do not create tags in Phase 3 source work** — tags are operator/release-manager actions after approval.

## Principles

- `main` is the only production-approved long-lived branch.
- All changes land via short-lived feature/fix branches and Pull Requests into `main`.
- Required CI checks must pass before merge.
- A release tag is created only after explicit approval.
- Production deployment uses an **exact approved commit SHA or release tag**.
- Direct production-server source edits are **forbidden**.
- Force pushes are **forbidden** on `main` and on shared remediation/release branches.

## Branch naming

| Type | Pattern | Example |
| --- | --- | --- |
| Feature | `feature/<short-kebab>` | `feature/work-order-filters` |
| Fix | `fix/<short-kebab>` | `fix/phase3-release-source-alignment` |
| Hotfix | `hotfix/<short-kebab>` | `hotfix/login-csrf-regression` |

## Pull Request requirements

- Target `main` (or an approved integration branch when documented).
- Description includes change ticket, risk summary, and rollback note.
- At least **one** required human review (Tech Lead or designated reviewer).
- All required CI checks green (see `BRANCH_PROTECTION_REQUIREMENTS.md`).
- No secrets, real `.env`, keys, or generated local artifacts in the diff.

## Merge method

- Prefer **squash merge** for feature/fix PRs to keep `main` history readable.
- Merge commit allowed for release integration PRs when preserving multi-commit history is intentional.
- Never rebase/push-force shared branches after review starts.

## Release version strategy

1. Version string in `maintainpro/package.json` is the application version (`APP_VERSION`).
2. Immutable runtime identity is the **full Git commit SHA** (`APP_COMMIT_SHA`).
3. After approval, Release Manager creates annotated tag: `maintainpro-vX.Y.Z` pointing at the approved SHA.
4. Images are tagged `maintainpro-api:<SHA>` / `maintainpro-web:<SHA>` (source of truth). Optional additional tags `maintainpro-api:maintainpro-vX.Y.Z` may be applied.

## Rollback release strategy

- Redeploy previous known-good SHA/tag and previous API/Web image tags.
- Preserve MongoDB, Redis, and MinIO volumes.
- Do not automatically reverse Prisma schema changes.
- Follow `PRODUCTION_ROLLBACK_RUNBOOK.md`.

## Emergency hotfix process

1. Branch `hotfix/<issue>` from the production tag/SHA currently running.
2. Minimal fix + focused tests.
3. PR into `main` with expedited review.
4. Tag `maintainpro-vX.Y.Z` after merge approval.
5. Deploy using guarded helper (explicit execute) and record evidence.
6. Back-port to any open release branches if still active.

## Server source-alignment rules

- Production servers must run images/config from an approved release SHA/tag only.
- `git status` on the server working copy must be clean for application source.
- Direct edits under the repo on the server are incidents (`DEPLOY-REL-014`).
- Operators use `scripts/audit-server-release.ps1` (read-only) to detect drift.
- Configuration secrets live only in the server `.env` (existence checked; values never committed or printed).