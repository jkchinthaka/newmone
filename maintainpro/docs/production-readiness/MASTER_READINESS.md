# Master readiness — 2026-08-19 FG go-live gate

Date: 2026-08-19  
Branch: `fix/live-production-remediation`  
Release commit: `89c7d3ca4cb875bd93f9d3f3d4475cae08c7f9b3`

## Git / remote sync

| Checkpoint | SHA | Remote? |
|---|---|---|
| Inventory engine | `bc5c82a0` | YES |
| FG Next.js UI | `2213a2f3` | YES |
| Frontend unification | `795b13b3` | YES |
| WO approval vs reservation | `d74789a1` | YES |
| Django FG subtree + occurrence tokens | `0eab98fa` | YES |
| FG Mongo bootstrap guards | `89c7d3ca` | YES |

`REMOTE_HEAD == LOCAL_HEAD` at `89c7d3ca`. No stranded valid commits on target worktree.

## FG Digital Records — business rules

| Form | Rule | Django JSON API |
|---|---|---|
| CL18 | MULTIPLE independent records/day + occurrence token | date + occurrenceToken |
| CL24 | ONE record/day | date only |
| CL30 | MULTIPLE independent records/day + occurrence token | date + occurrenceToken |

Django source: `maintainpro/systems/fg-digital-recording/`

Key modules: `controlled_forms.py`, `scheduling/services.py` (`ensure_controlled_daily_task`), `recording/api_views.py`, `recording/daily_views.py`.

Next.js client sends stable in-flight tokens via `apps/web/lib/fg-occurrence.ts` (sessionStorage intent key; consumed after successful open).

## FG test evidence (2026-08-19)

Environment: Python 3.13 (`uv`), local disposable FG Postgres `127.0.0.1:5433`, Redis `127.0.0.1:6380`. Not production.

| Suite | Result |
|---|---|
| Targeted controlled-record JSON API (prior run) | **19 passed** |
| Recording + Supervisor + QA workflows | **144 passed** (~5m) |
| Security + unit + accounts (+ CSRF/auth) | **138 passed**, 6 skipped (Mongo-only) |
| MaintainPro FG Jest (mappers, BFF, contract, SSO) | **26 passed** |
| Full FG pytest collect | **999 collected** — full suite not executed end-to-end in this gate |

Interrupted Windows run (exit 4294967295) treated as **INFRA_INTERRUPTED**, not TEST_FAILED.

## FG operational UI decision

`FG_OPERATIONAL_UI=DJANGO_VALIDATED`

`FG_NEXTJS_UI_ENABLED` / `NEXT_PUBLIC_FG_NEXTJS_UI_ENABLED` remain **false** until FG Playwright E2E + production browser smoke complete.

MaintainPro SSO handoff path remains: `/api/fg-sso/handoff` → Nest `/auth/fg-sso/exchange` → Django consume.

## MaintainPro regression (2026-08-19)

See session terminal output for full suite. Prior gate: typecheck PASS, RBAC 697/0, tenant unapproved=0, secret scan 12/12, backend 1147 passed / 10 skipped, build PASS.

## Inventory / disposable Mongo

Prior disposable Mongo PASS is **stale** after Prisma commits `51bba3fc` and `20d7061f`. Not re-run (`DISPOSABLE_MONGO_URL` unset).

## Security

Production `npm audit --omit=dev`: **critical=0**. Historical Git credential: **PENDING_EXTERNAL_ACTION** (no history rewrite).

## Production blockers (FG hard requirement)

| Blocker | Status |
|---|---|
| FG production host DNS (`fg.nelna.lk`) | **NOT RESOLVED** — NXDOMAIN at gate time |
| FG Django service deployed alongside MaintainPro | **NOT VERIFIED** — not in `maintainpro/docker-compose*.yml` |
| FG production browser smoke (CL18/24/30) | **MANUAL_AUTHORIZED_VALIDATION_REQUIRED** |
| FG Playwright E2E | **NOT RUN** — suite requires disposable FG stack + `FG_E2E=1` |
| Render API commit pin | **unknown** — `/health` reports `commit=unknown` |
| Business UAT signoff | **PENDING** |

## Live URLs (configured, not necessarily at release SHA)

| Service | URL |
|---|---|
| Web | https://newmone.chinthakajayaweera1.workers.dev |
| API | https://newmone.onrender.com |
| FG (documented target) | https://fg.nelna.lk — DNS not live |

`PRODUCTION_CHANGED=NO` for this documentation-only update unless operator deploys from `89c7d3ca`.
