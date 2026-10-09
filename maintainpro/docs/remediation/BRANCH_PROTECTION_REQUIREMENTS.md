# Branch Protection Requirements

**Status:** PROTECTION_ENABLED / AUTO_MERGE_SETTING_OFF

GitHub is the final merge authority. Do not remove or weaken the checks below. Do not claim a setting changed unless this file cites a fresh `gh api` read.

## Enforced on `main` (API evidence, 2026-10-09)

`GET /repos/jkchinthaka/newmone/branches/main/protection` returned:

- Required status checks, strict (branch must be up to date): `validate-monorepo`, `release-validate`, `docker-build`, `full-stack-e2e`
- Enforce admins: enabled
- Allow force pushes: disabled
- Allow deletions: disabled
- Required approving reviews: 0
- Rulesets: none

`GET /repos/jkchinthaka/newmone` returned `allow_auto_merge: false`. Merge commit, squash, and rebase are all allowed. Auto-merge cannot be enabled on a pull request until an owner turns **Allow auto-merge** on in the repository settings. Agents must not flip that setting themselves and must not admin-merge while it is off.

These four check names are the current required CI gates. Workflow files that produce them:

- `.github/workflows/pr-validation.yml` → `validate-monorepo`
- `.github/workflows/release-validation.yml` → `release-validate`
- `.github/workflows/docker-build-check.yml` → `docker-build`
- `.github/workflows/full-stack-e2e.yml` → `full-stack-e2e`

## Operator checklist still open

1. Enable repository **Allow auto-merge**. Leave the four required checks in place.
2. Keep force-push and branch deletion disabled.
3. Keep admin enforcement on, so a failing check cannot be merged with an override.
4. Optional strengthening, not a substitute for the checks above: require conversation resolution or a review if the product owner wants a human GitHub approval in addition to `qa-reviewer`.

The longer audit names in older notes (secret-safety, nginx-routing, tenant-audit, RBAC-audit, lint, typecheck, unit tests, security tests, build, image scan, Compose validation, release manifest) are covered inside the four jobs where those workflows already run them. Do not delete those jobs or their steps to make auto-merge easier.

## Agent use

Before `gh pr merge --auto`, re-read `allow_auto_merge` and the required contexts. If auto-merge is off, or any required check is missing, stop after opening the non-draft PR. `qa-reviewer` PASS is required before that command and is not itself a GitHub check.