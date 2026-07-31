# Branch Protection Requirements

**Status:** OPERATOR_ACTION_REQUIRED  

This document lists required checks for `main`.  
**Do not claim GitHub branch protection is enabled without GitHub UI/API evidence.**

## Required checks (names to configure)

- secret-safety
- nginx-routing
- tenant-audit
- RBAC-audit
- lint
- typecheck
- unit/integration tests
- security-sensitive tests
- build
- API Docker build
- Web Docker build
- image-secret-path scan
- production Compose validation
- release-manifest generation

Mapped workflows:

- `.github/workflows/pr-validation.yml`
- `.github/workflows/docker-build-check.yml`
- `.github/workflows/release-validation.yml`

## Operator configuration checklist

1. Protect `main`.
2. Require PR before merge.
3. Require the checks above.
4. Require at least one approving review.
5. Disallow force pushes.
6. Disallow deletions.
7. Restrict who can push tags / create releases.

Evidence: screenshot or `gh api` output showing protection rules (no secrets).