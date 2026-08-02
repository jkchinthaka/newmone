# Go-Live Gates

**Current documented verdict (prior pack):** **NO-GO**  
**This analysis:** Reinforces NO-GO until P0 gates below pass with evidence.

## Gate 0 — Safety baseline (entry to any prod change)

| ID | Gate | Pass criteria |
| --- | --- | --- |
| G0.1 | Credential incident | MongoDB root rotated; old credential invalidated; incident record filed (**operator task** — no secrets in Git) |
| G0.2 | No secret in images | `.dockerignore` excludes env/keys; images rebuilt; spot-check no `.env` in layers |
| G0.3 | Env strategy | Production does not boot on CI placeholder JWT/DB URLs |
| G0.4 | Port exposure | Public TCP 80 only (HTTP phase); 27018/6379/9000/9001/3000/3001 not internet-reachable |

## Gate 1 — Authentication on declared access mode

| ID | Gate | Pass criteria |
| --- | --- | --- |
| G1.1 | Routing | `/api/backend/*` → Next; `/api/*` (non-backend) → Nest; proven with request traces |
| G1.2 | BFF upstream | `API_INTERNAL_URL=http://api:3000/api` (or equivalent) works inside Docker |
| G1.3 | Cookies | Login creates HttpOnly access+refresh; CSRF present; **no** JWT in localStorage |
| G1.4 | HTTP mode | If public HTTP required: explicit `ALLOW_INSECURE_HTTP=true` + `COOKIE_SECURE=false`; Secure absent; business risk accepted in writing |
| G1.5 | HTTPS default | Without HTTP opt-in, Secure cookies remain required |

## Gate 2 — Traceability and rollback

| ID | Gate | Pass criteria |
| --- | --- | --- |
| G2.1 | SHA | `/api/build-info` or health metadata shows real Git SHA ≠ `unknown`/`ci-placeholder` |
| G2.2 | Source | Running config diff vs tagged release documented |
| G2.3 | Rollback | Prior image/tag redeploy tested once on staging or pilot |

## Gate 3 — Quality

| ID | Gate | Pass criteria |
| --- | --- | --- |
| G3.1 | CI | PR validation green on release SHA |
| G3.2 | Auth e2e | Cookie/BFF tests green; localStorage token assertions removed |
| G3.3 | Real-stack smoke | Disposable stack: login → one WO → one stock movement |
| G3.4 | Tenant/RBAC | Isolation + rbac audits PASS |

## Gate 4 — Business controls (pilot)

| ID | Gate | Pass criteria |
| --- | --- | --- |
| G4.1 | Negative stock | Cannot issue below zero |
| G4.2 | Approvals | PO dual approval path demonstrated |
| G4.3 | Audit | Sensitive actions leave audit rows |
| G4.4 | ERP | Sync failure visible; no silent data loss |

## Gate 5 — Operability

| ID | Gate | Pass criteria |
| --- | --- | --- |
| G5.1 | Backup | Timestamped Mongo backup off-server; restore drill counts match |
| G5.2 | Reboot | After Windows reboot, stack healthy without manual rediscovery |
| G5.3 | Disk/logs | Log rotation + disk alert defined |
| G5.4 | On-call | Incident owner named for auth/DB/outage |

## Go / No-Go decision rule

- **GO (controlled pilot):** All G0 + G1 + G2 + G3.1–G3.4 + G4.1 + G5.1–G5.2 pass with attached evidence; HTTP residual risk accepted if applicable.
- **NO-GO:** Any P0 open (R-01…R-07, R-19 unaccepted), or login session cannot be established in the real access mode, or backups unrestorable.

## Pilot definition of done

- Limited tenant(s) and named pilot users.
- Daily health check + error review for pilot window (recommend ≥ 5 business days).
- No expansion to full user base until Gate 4–5 complete.
---

## Phase 1 gate progress (2026-07-31)

| Gate | Status |
| --- | --- |
| G0.1 Credential incident / rotation | **BLOCKED** — runbook ready; operator evidence pending |
| G0.2 No secret in images | Repo controls VALIDATED; server rebuild still required |
| G0.3 Env strategy | VALIDATED in source (prod compose separation) |
| G0.4 Port exposure | VALIDATED in source compose; host firewall still operator |
---

## Phase 2 gate progress (2026-07-21)

| Gate | Status |
| --- | --- |
| G1.1 Routing | SOURCE_DONE (static nginx validation); live traces OPERATOR |
| G1.2 BFF upstream | SOURCE_DONE (compose requires API_INTERNAL_URL); runtime OPERATOR |
| G1.3 Cookies | SOURCE_DONE (BFF HttpOnly + CSRF); live browser evidence OPERATOR |
| G1.4 HTTP mode | SOURCE_DONE (fail-closed dual opt-in); business risk acceptance still required |
| G1.5 HTTPS default | SOURCE_DONE (Secure remains default) |
| G3.2 Auth e2e | SOURCE_UPDATED (cookie architecture); full Playwright run not claimed here |
| Live HTTP login validated | **NO** - smoke table empty |
| G0.1 Mongo rotation | Still BLOCKED / OPERATOR |

---

## Phase 2 closeout gate note

| Gate | Status |
| --- | --- |
| G1.3 Cookies | SOURCE_VALIDATED (BFF-only browser cookies; Nest Option A) |
| G1.1–G1.5 | SOURCE_VALIDATED; live traces OPERATOR_RUNTIME_VALIDATION_REQUIRED |
| Live HTTP login | Not marked complete |

---

## Phase 3 source progress (2026-08-01)

| Item | Status |
| --- | --- |
| Branch / release model | SOURCE_VALIDATED (`RELEASE_BRANCH_STRATEGY.md`) |
| Build metadata strategy | SOURCE_VALIDATED (`APP_*` + readiness assessment) |
| Immutable API/Web image tags | SOURCE_VALIDATED (`maintainpro-*:${APP_COMMIT_SHA}`) |
| Deployment scenarios | SOURCE_VALIDATED (`DEPLOYMENT_SCENARIOS.md`) |
| Rollback architecture | SOURCE_VALIDATED (`PRODUCTION_ROLLBACK_RUNBOOK.md`) |
| Schema-change gate | SOURCE_VALIDATED (`PRISMA_SCHEMA_CHANGE_GATE.md`) |
| Branch protection operator config | OPERATOR_ACTION_REQUIRED |
| Mongo root rotation | BLOCKED / OPERATOR_ACTION_REQUIRED |
| Live HTTP smoke | OPERATOR_RUNTIME_VALIDATION_REQUIRED |
| Docker image secret-path scan (local engine) | BLOCKED when Docker unavailable; CI runs on ubuntu |
| Port 80 IIS vs Nginx ownership | unanswered (A-03) |
| Production deployment | NOT DONE (Phase 3 forbids live deploy) |

---

## Phase 4 source progress (2026-08-01)

| Item | Status |
| --- | --- |
| Isolated E2E Compose | SOURCE_VALIDATED |
| E2E safety / no-mock validators | SOURCE_VALIDATED |
| Real-stack Playwright suite | SOURCE_VALIDATED |
| Full-stack E2E CI workflow | SOURCE_VALIDATED |
| Docker runtime on this agent | BLOCKED / OPERATOR_RUNTIME_VALIDATION_REQUIRED when engine down |
| Live production login | NOT validated |
| Node-based API/Web healthchecks | SOURCE_VALIDATED (Phase 4B) |
| Full-stack CI runtime | NOT RUNTIME_VALIDATED |

| Playwright E2E env loader | SOURCE_VALIDATED; full runtime pending |
| E2E env line-boundary / materialize | SOURCE_VALIDATED (Phase 4B attempt 3) |
| Nginx BFF proxy buffers + auth-path diag | SOURCE_VALIDATED (Phase 4B attempt 4) |
| Login success HTTP 200 contract | SOURCE_VALIDATED (Phase 4B attempt 5) |
| Browser session request-context + logout CSRF | SOURCE_VALIDATED (Phase 4B attempt 6; runtime pending) |
| Work-order create payload + CSRF-003 exact 201 | SOURCE_VALIDATED (Phase 4B attempt 7; runtime pending) |
| Full-stack CI runtime evidence (`30696336211` / `0ecd3fa`) | PARTIAL_RUNTIME_VALIDATION (not production go-live) |

## Phase 5A inventory gate

Required before upgrading inventory runtime from PARTIAL to RUNTIME_VALIDATED:

- Focused inventory gate pass
- E2E-INV mandatory tests: failed=0, skipped=0
- Negative stock and duplicate issue prevented
- Cross-tenant issue blocked
- CSRF inventory mutation path exact

Do not claim production go-live from Phase 5A alone.

## Phase 5A inventory runtime closed

Focused inventory gate + E2E-INV-001..016 passed with failed=0 skipped=0 on `30698756592`. Still not a production go-live approval.

## Phase 5B cleanup safety gate

- Functional E2E may be green while CI cleanup still violates volume-preservation policy.
- Gate: corrected Full-Stack E2E workflow must use nondestructive Compose down and pass `validate:nondestructive-docker-cleanup`.
- Phase 5C blocked until this gate is green on the exact corrected SHA.

## Phase 5C gate

- Gate: procurement create to GRN must pass Full-Stack E2E (failed=0, mandatory skipped=0).
- Gate: Inventory Keeper cannot erp_apply / PO erp_sync.

## Phase 5D gate

Management information / dashboard / reports / audit / export controls.

### Entry criteria

- Phase 5B RUNTIME_VALIDATED: workflow `30712469601`, SHA `fe3b3992d883d33c916b3595769add2c4db8878a`
- Phase 5C RUNTIME_VALIDATED: workflow `30715842098`, SHA `512745d678a4be6b0d0a62f2400763ff9fd4ec08`
- Contracts published under `docs/remediation/` (KPI catalog, access matrices, financial/ERP/audit/export)

### Exit criteria (before claiming RUNTIME_VALIDATED)

- Focused `@management-info-gate` pass: failed=0, mandatory skipped=0
- Full-Stack E2E pass on the exact tested application SHA (record SHA only after success)
- KPI reconciliation tests green (including MTBF insufficient-data)
- Financial double-count prevention proven
- Export neutralization + audit events proven
- ERP monitor: MOCK only; no secret leakage
- Cleanup: `down --remove-orphans` only

Phase 5D alone does **not** authorize production go-live.

## Phase 6A — recovery rehearsal gate

| Gate | Status | Notes |
| --- | --- | --- |
| G5.1 Backup + restore drill | **OPERATOR_ACTION_REQUIRED** | Requires operator off-host Mongo backup + counted restore; Phase 6A E2E rehearsal is mechanics-only |
| G5.1 E2E recovery gate | **RECOVERY_RUNTIME_VALIDATED** | Workflow `30735445667`; app SHA `baad89621c87ddd4b840bb9c77cb20efcb1b79b6`; DR-E2E / integrity / object passed; full suite 103/0/0 |
| Replication vs backup | **CONTRACT_DEFINED** | Replication health must not satisfy G5.1 alone |

Phase 6A does **not** approve production go-live or `PRODUCTION_DR_VALIDATED`. Preserve Phase 5B/5C/5D RUNTIME_VALIDATED SHAs.

## Phase 6B - operations / observability gate

| Gate | Status | Notes |
| --- | --- | --- |
| G5.2 Host reboot recovery | OPERATOR_ACTION_REQUIRED | HOST_REBOOT_RECOVERY_RUNBOOK.md; never claim HOST_REBOOT_VALIDATED from container restart |
| G5.3 Disk / log rotation | PROVISIONAL / OPERATOR_ACTION_REQUIRED | LOG_RETENTION_AND_ACCESS_POLICY.md json-file local only; MANAGEMENT_APPROVAL_REQUIRED retention |
| G5.4 On-call owner | OPERATOR_ACTION_REQUIRED | OPERATIONAL_ALERT_CATALOG.md P0 routing |
| Live vs ready probe split | OPERATIONS_RUNTIME_VALIDATED | Workflow `30737905003`; live 200 / ready 200; mongo outage ready 503 path in rehearsal |
| Request correlation | OPERATIONS_RUNTIME_VALIDATED | `request_correlation=pass`; max 64 allowlist |
| Metrics + alerts | OPERATIONS_RUNTIME_VALIDATED (protected) / PROVISIONAL thresholds | Soft evaluate/list + metrics auth; no real sends |
| Queue startup reconcile | OPERATIONS_RUNTIME_VALIDATED | `redis_reconciled=yes` |
| Graceful shutdown / startup stages | OPERATIONS_RUNTIME_VALIDATED | api/web/nginx restart pass; data_persisted=yes |
| E2E-OPS / E2E-FAIL / E2E-QUEUE | OPERATIONS_RUNTIME_VALIDATED | App SHA `dfcb136edf1ca6ecf8aff94fe892418c0d40d0cd`; ops 11/0/0; full suite 103/0/0 |
| PRODUCTION_OPERATIONS_VALIDATED | NOT CLAIMED | Isolated CI only; host reboot + real channels remain operator-owned |

Phase 6B does **not** approve production go-live. Preserve Phase 5B/5C/5D RUNTIME_VALIDATED and Phase 6A RECOVERY_RUNTIME_VALIDATED SHAs:
5B fe3b3992d883d33c916b3595769add2c4db8878a / 30712469601;
5C 512745d678a4be6b0d0a62f2400763ff9fd4ec08 / 30715842098;
5D 5836bc330cc03e7a3f658ed9cee5f334649f3091 / 30719294386;
6A baad89621c87ddd4b840bb9c77cb20efcb1b79b6 / 30735445667;
6B dfcb136edf1ca6ecf8aff94fe892418c0d40d0cd / 30737905003 OPERATIONS_RUNTIME_VALIDATED.

## Phase 6C - production security hardening

**Status:** **SECURITY_RUNTIME_VALIDATED** (fixture/CI only — not PRODUCTION_SECURITY_VALIDATED). Workflow `30738838804` / SHA `205d2d23825ff0959310b3a6735b58dff88f1858`.
**Prerequisite:** Phase 6B OPERATIONS_RUNTIME_VALIDATED (`dfcb136` / `30737905003`).
**Port owner:** PORT_OWNER_DECISION_REQUIRED.
**Mongo root rotation:** OPERATOR_OWNED_P0 — never auto-rotated.

Preserve Phase 5B/5C/5D/6A/6B evidence SHAs unchanged.

## Phase 7 - UAT / training / rollback / go-live decision

**Status:** SOURCE_IMPLEMENTED — awaiting CI `UAT_CONTROL_RUNTIME_VALIDATED`.
**Base:** Phase 6C evidence tip `1a435c71c58c22e195c4c2199e48812bf4cd5b81` / SECURITY_RUNTIME_VALIDATED.
**Expected CI recommendation:** DELAYED (no formal UAT/training/HTTPS/port-owner/management sign-offs in CI).
**Phase 8:** not executed.
