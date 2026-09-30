# CI/CD status

**Updated:** 2026-09-30. Production deployment is not enabled. Nothing in these workflows deploys production.

| Area | Status |
| --- | --- |
| CI | PARTIAL |
| Staging CD | BLOCKED |
| Production CD | NOT ENABLED |

CI is partial because the source gates are current, and the full Jest run plus full-stack E2E are not green. Jest still has stale mock failures (missing `workOrder.count` and one undefined `create`). Full-stack E2E still stops when the pinned MinIO image returns `401 Unauthorized`. Evidence upload is not marked successful.

## Hosting

| Provider | Class | Role |
| --- | --- | --- |
| Render | ACTIVE | Intended API host. Not deployed from these workflows. |
| Vercel | ACTIVE | Intended web host. Preview builds can start from the GitHub connection. A recent preview failed. That check is not a required source gate. |
| Cloudflare Workers | ALTERNATE | Second web target. Not required for merge. |
| Netlify | LEGACY/UNUSED | A preview hook still runs. It is not the selected web path and is not required for merge. |

`push` to `main` does not deploy production. Docker Image CI no longer runs on push or pull request.

## Required before merge to main

| Check | Required now | Why |
| --- | --- | --- |
| PR Validation | Yes | Source quality: install, Prisma generate, tenant audit, RBAC audit, lint, typecheck, full Jest, security suites, critical regressions, build, secret safety. |
| SQL Server Migration Gate | Yes, when Prisma, API, or lockfile paths change | Fresh SQL Server, `migrate deploy`, seed, seed again, API typecheck, integrity tests. Not `db push`. |
| Release Validation | Yes | Same source gates plus retired-feature checks, compose structure, disposable images, release manifest. |
| Docker Build Check | Yes | Image build without publishing. |
| Full-Stack E2E | No, until storage starts | MinIO pull is blocked. Do not require a permanently red external image. |
| Vercel, Cloudflare, Netlify | No | Hosting connections. Not source correctness. |

Branch protection on GitHub still has to be set by a repository admin. This file records the intended required set. It does not change GitHub settings.

## Workflows

| Workflow | Status | Purpose | Trigger | Blocking? | Secrets | Current issues | Action |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `pr-validation.yml` | KEEP / UPDATE | Main source gate | Pull request to `main` or `develop` | Yes | None. CI-only public API URLs. | Full Jest is not green. | Push trigger removed so a main push is not a second automatic pipeline. Critical suites are named: refresh replay, favorites, Phase 13 access, ERP stock boundary, maintenance reports, PM duplicate generation, fleet lifecycle. |
| `release-validation.yml` | KEEP / UPDATE | Release candidate source check | Pull request to `main`, or manual | Yes | None | Same Jest gap. Image build can still fail until the reset-password prerender fix is on the run. | Retired Live Map files are checked. Email and evidence are logged as blocked. A direct PM call is not treated as a scheduler pass. |
| `sqlserver-migration-gate.yml` | KEEP | Empty SQL Server, migrate, seed twice, typecheck, integrity | Pull request when Prisma, API, package, or lockfile changes, or manual | Yes on those paths | Disposable SA password in the workflow, not a production secret | Passed on the previous consolidation run | Lockfile path added. Still uses `migrate deploy`. |
| `full-stack-e2e.yml` | UPDATE | Browser and stack rehearsal | Pull request to `main`, or manual | Not required while storage is blocked | Disposable E2E values materialized in the job. Not production. | MinIO image `quay.io/minio/minio:RELEASE.2025-04-22T22-12-26Z` returns 401. | Evidence status is written as BLOCKED. Failure logs are SQL Server, Redis, and API. The old Mongo failure dump was removed. `test/phase4-*` push trigger removed. |
| `docker-build-check.yml` | KEEP | Build API and web images and check compose | Pull request to `main` or `develop` | Yes | None | Web image prerender previously failed on `/reset-password`. | Push trigger removed. |
| `docker-image.yml` | RETIRE from automatic runs | Old root-Dockerfile tag job | Manual only | No | None | Duplicated Docker Build Check and looked like a main-branch publish. | Manual run prints that production deploy is off and does not build. |
| `develop-staging-deploy.yml` | UPDATE | Staging build, then an explicit blocked deploy | Push to `develop`, or manual | The CD job fails on purpose | None configured | Staging host, database, Redis, storage, and mail are absent. | Build job can pass. Deploy job exits non-zero with `STAGING_CD=BLOCKED`. |

The food-recording workflow under `maintainpro/systems/fg-digital-recording/.github/workflows/` is a nested system tree. It is not a root MaintainPro deploy.

## Redis and email

Local Redis answers on port 6380. That does not mean the CI PM scheduler ran. No workflow treats a direct `auto-wo` call as a scheduled run.

Email delivery verification is **BLOCKED**. CI does not set production SMTP and does not print reset or invite tokens.

## Artifacts

Kept: Jest coverage when the API job produces it, the release manifest, and redacted E2E logs. Workflows do not upload `.env` files. Log lines that look like passwords, secrets, tokens, or authorization values are redacted before upload.

## Permissions

Root workflows that deploy nothing use `contents: read`. Pull request jobs do not receive production credentials.
