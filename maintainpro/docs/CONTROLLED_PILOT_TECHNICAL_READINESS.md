# Controlled pilot technical readiness

Date: 2026-10-12. Branch `chore/pilot-readiness-20261012` at `4d394657`. This file is not on the frozen UX branch.

The UX changeset stays uncommitted on `fix/ux-confirmed-defects` in the main worktree. Independent QA for that changeset is **QA BLOCKED — EXTERNAL BILLING DEPENDENCY**. This document does not approve a release.

`docs/go-live/pilot-rollout-plan.md` still describes Cloudflare Workers, Render, and MongoDB Atlas. Those targets are retired. The current local stack is the Next.js app, the NestJS API, and SQL Server. `db:push` is refused. Flutter is not part of the product.

## Evidence on 2026-10-12

Commands run from the pilot worktree unless noted. No database writes, gate movements, stock changes, or notification sends.

| Check | Command or source | Result |
| --- | --- | --- |
| Stack guard | `node maintainpro/scripts/test/pilot-stack-guard.selftest.mjs` | `pilot-stack-guard: ok` |
| Public health | `GET http://127.0.0.1:3000/health` on the already running API | 200 |
| Liveness | `GET http://127.0.0.1:3000/health/live` | 200 |
| Minimal readiness | `GET http://127.0.0.1:3000/health/ready` | TIMEOUT. No response at 8 seconds or at 20 seconds. The running process was not restarted |
| Minimal readiness source | `getMinimalReadiness` and `checkQueues` | Queue health uses `HEALTHCHECK_DEPENDENCY_TIMEOUT_MS` (default 5000). Database uses the same budget. Object storage returns immediately when unset, or aborts a MinIO probe at 2000 ms. The three checks now run together, so the wait is the longest check rather than the sum. Optional Redis timeout stays HTTP 200 when the database is up. Required Redis timeout or a failed database check returns HTTP 503. The body is status, time, service, and build. Logs use the sanitized dependency message |
| Readiness Jest | `npx jest --config ./jest.config.cjs test/health-integration-modes.spec.ts --forceExit` from `apps/api` | 7 passed, exit 0. Cases: queue resolves, optional reject, required reject, database failure, optional hang, required hang. No SQL Server or Redis connection |
| Isolated Nest process | Not started | BLOCKED. Booting the API can open Prisma and queue reconciliation against the shared database. A separate tsx HTTP process could not load the Nest service. Port 3000 was left running the older code |
| Replication defaults | `npx tsx scripts/test/replication-config.selftest.ts` | `replication-config: ok`. Omitted and false stay off. True stays on unless mode is disabled. Joi rejects `maybe`. The runtime parser treats `maybe` as off |
| Readiness timeout tests | `npx jest --config ./jest.config.cjs test/health-integration-modes.spec.ts` from `apps/api` | 3 passed, exit 0 |
| Migrations | `npm run db:migrate:status` in the main `maintainpro` directory | 28 migrations, schema up to date. Read-only |
| Replication default | Source change in this worktree | Omitted `DATABASE_REPLICATION_ENABLED` now defaults to false in Joi and `getDatabaseReplicationConfig` |

The running API process was not restarted, so it still has the previous replication default until the next start. This worktree change is not deployed.

## Readiness classification

| Requirement | Status | Note |
| --- | --- | --- |
| API health | PASS | `/health` and `/health/live` returned 200 |
| Minimal readiness endpoint | TIMEOUT on the running API | Source fix is in this worktree and covered by the Jest cases. It is not loaded until the API is restarted with approval |
| SQL Server connectivity | PASS | Prisma migrate status connected and reported the schema up to date |
| Migration status | PASS | 28 migrations, none pending |
| Authentication and session | NOT TESTED | Not re-run in this pass. Prior UX login checks are on the other branch |
| Role permission enforcement | PASS for the System Health nav split only | Guard asserts the page role stays `SUPER_ADMIN`. API readiness still allows `ADMIN` and `SUPER_ADMIN` |
| Work orders, requests, PM, assets, fleet, inventory, reports, audit | NOT TESTED | A new sign-in was not attempted, to avoid the login rate limit. No stock, gate, approval, or work-order write was made |
| Fleet Gate safety | NOT TESTED | Existing gate rules were not re-executed. Do not gate a vehicle |
| Inventory and Bileeta | PASS for defaults | Apply and read-only sync default off. Live sync was not enabled |
| Notification configuration | PASS for defaults | Real sends, UAT sends, SMTP, and SMS default off |
| Reports and audit trail | NOT TESTED | No report or audit query was run |
| Environment example | PASS | `.env.example` keeps SQL Server, replication disabled, and providers off |
| CI/CD | NOT TESTED | GitHub checks were not run. No pull request |
| Logging and monitoring | APPROVAL REQUIRED | Detailed readiness stays behind the unresolved System Health policy |
| Backup and recovery | NOT TESTED | No backup or restore was performed |
| Pilot user onboarding | APPROVAL REQUIRED | Use seeded non-production accounts only. No new users were created |
| Rollback | PASS as a procedure | See below. It was not executed |

## Status by area

| Area | Local technical state | Pilot blocker | Production-only blocker |
| --- | --- | --- | --- |
| Authentication and RBAC | Login and role redirects exist. Seeded non-production accounts are used for read-only checks. | Human UAT of each role is pending | Do not use production credentials |
| Work orders | Queue and drawer behavior is in the uncommitted UX changeset | That changeset has no independent QA PASS | None identified in this pass |
| Requests | Triage copy is in the UX changeset. Do not accept a request during pilot checks | Same QA hold | None identified in this pass |
| Preventive maintenance | Due-state copy is in the UX changeset. Do not pause or evaluate | Same QA hold | None identified in this pass |
| Assets | Phone cards and named page size are in the UX changeset | Same QA hold | None identified in this pass |
| Fleet and gate | Readiness wording and phone layout are in the UX changeset. Do not gate a vehicle | Same QA hold | None identified in this pass |
| Inventory and Bileeta | Display treats Bileeta as the stock authority. Do not issue, count, or export | Same QA hold | Do not turn on live ERP synchronization |
| Notifications | Unsafe external targets are rejected in the UX changeset. A real linked record was not present | Browser deep-link check is NOT TESTED. Do not create a notification to force it | Do not enable production notification delivery |
| Reports | Completion wording is limited to the operations category | Human UAT pending. Do not export | None identified in this pass |
| Administration | Non-admin roles return home from `/admin` in earlier read-only checks | Human UAT pending | None identified in this pass |
| Monitoring and system health | Page and navigation are `SUPER_ADMIN` only. `GET /health/readiness` and `GET /health/deployment-readiness` still allow `ADMIN` and `SUPER_ADMIN`. Public `/health/ready` stays separate | Policy UX-06 is unresolved. Do not change either side | Do not expose detailed readiness on a public probe |
| Deployment and CI | Required GitHub checks remain the merge authority. Historical Vercel, Cloudflare, and MinIO pull failures are not local pilot gates | UX branch is not pushed and has no PR | Do not deploy |

## Operator checklists

Deployment for a later pilot, not done now: start from this branch only after review, set `DATABASE_URL` outside git, keep `DATABASE_REPLICATION_ENABLED=false` unless a backup database is approved, and leave `ERP_STOCK_SYNC_APPLY_ENABLED`, `NOTIFICATION_REAL_SENDS_ENABLED`, and `SMS_ENABLED` false.

Environment: copy `.env.example` to an untracked `.env`. Replace the password placeholders locally. Do not commit that file.

Roles for a read-only pilot: technician uses My Jobs, supervisor uses request triage, manager uses work orders and PM, storekeeper uses inventory, gate officer uses Fleet Gate, administrator uses Administration. System Health stays a product-owner decision.

Daily monitoring that is allowed without a policy change: `GET /health` and `GET /health/live`. Treat a non-200 as an incident. Do not call the detailed readiness route from a public monitor.

Incident response: stop the affected write (gate, stock, approval, or notification send), record the time and route, and roll back the application only. Severity is Critical when the wrong record can change or the database is unreachable, Major when the task needs a workaround, and Minor when wording is wrong.

Backup expectation: this pass did not take or restore a backup. A pilot must not start on the assumption that a restore has been proven.

Acceptance for this technical slice: the stack guard passes, public health returns 200, and migrations report up to date. Human task success is not accepted until testers complete `UI_UX_HUMAN_UAT.md` on the UX branch.

## Known decisions

| Decision | Status |
| --- | --- |
| Independent QA of the frozen UX changeset | BLOCKED by the unpaid invoice. Do not bypass |
| System Health page versus readiness API roles | APPROVAL REQUIRED |
| Live Bileeta synchronization | APPROVAL REQUIRED. Defaults stay off |
| Production email or SMS | APPROVAL REQUIRED. Defaults stay off |
| Human UAT and screen-reader results | NOT TESTED |

## Rollback

Application rollback for this pilot-prep branch is deleting the uncommitted files on `chore/pilot-readiness-20261012` or removing that worktree. It does not touch `fix/ux-confirmed-defects` or `C:\Users\chint\AppData\Local\MaintainPro\ux-review-20261012`. Do not run `docker compose down -v` or a database reset as part of this rollback.

## Still pending

Human UAT, a real screen-reader pass, linked-notification browser navigation, the System Health policy decision, and an independent QA PASS on the frozen UX changeset. None of those are marked complete here.
