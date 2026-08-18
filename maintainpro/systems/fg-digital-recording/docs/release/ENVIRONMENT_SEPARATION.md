# Phase 21 — Environment separation

| Environment | Purpose | Status in repo evidence |
| --- | --- | --- |
| Local | Developer Compose | **Exists** |
| Test | CI / automated tests | **Exists** (GitHub Actions + Compose test profile) |
| Staging / UAT | Business acceptance | **NOT AVAILABLE** (APR-021 open) |
| Production | Live operations | **NOT AVAILABLE** |

## Rules

1. No test credentials or synthetic fixtures in production.
2. No shared secrets across environments.
3. Direct commits to `main` **do not** authorize production deploy.
4. Production deploy requires explicit gate ([RELEASE_GATE.md](RELEASE_GATE.md) + CI/CD approval).
