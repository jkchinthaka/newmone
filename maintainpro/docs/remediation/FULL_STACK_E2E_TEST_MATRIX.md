# Full-Stack E2E Test Matrix

**Status:** SOURCE_VALIDATED

| ID | Area | Coverage |
| --- | --- | --- |
| E2E-INFRA-001..010 | Infrastructure | Nginx, health, BFF 401, SHA, DB prefix |
| E2E-AUTH-001..016 | Auth | Login, cookies, token non-exposure, logout, refresh/session |
| E2E-CSRF-001..007 | CSRF | Missing/wrong/valid CSRF, GET/login exemptions |
| E2E-RBAC-001..005 | RBAC | Role denial paths |
| E2E-TENANT-001..008 | Tenant | Cross-tenant exclusion, switch without token leak |
| E2E-WO-001..012 | Work orders | Create/progress via real BFF API |
| E2E-INV-001..016 | Inventory | Keeper list/issue, idempotency, low-stock, delete deny, RBAC, tenant, CSRF |
| E2E-FILE-001..006 | Files | Controlled upload rejection paths |
| E2E-ERR-001..008 | Errors | Controlled 404/validation, no secret leaks |
| Perf smoke | Performance | Health latency + login timeout (CI only claims) |

Tags: `@mocked` (legacy `e2e/`), `@full-stack`, `@security`, `@tenant`, `@erp-control`, `@smoke`

| E2E-ENV-* | Loader/path/precedence/password non-exposure | SOURCE_VALIDATED |
| E2E-NL-* | Template LF + newline-safe materialize / no domain concat | SOURCE_VALIDATED |
| BFF-502-* | Upstream URL, hop-by-hop stripping, 4xx preservation, connectivity mapping | SOURCE_VALIDATED |
| AUTH-STATUS-* | Exact login success HTTP **200** (Nest/BFF/Nginx/Playwright/diagnostic) | SOURCE_VALIDATED |
| SESSION/LOGOUT-CSRF-* | BrowserContext request + CSRF double-submit + logout **200** | SOURCE_VALIDATED |
| WO-CREATE / CSRF-003 | Valid create payload includes `createdById` from `/auth/me`; exact **201** + read-back | SOURCE_VALIDATED |
| AUTH-PATH A/B/C | Direct API / direct BFF / Nginx login probes (safe metadata only) | SOURCE_VALIDATED (CI gate) |

Runtime note (attempt 5): run `30685973181` (42/8/2) — 502 resolved; Probes A/B/C=201; E2E-AUTH-001 failed only on exact **200 vs 201**. Canonical contract set to **HTTP 200 OK**.

Runtime note (attempt 6): run `30687319562` (44/6/2) — login/probes PASS; AUTH-011/012 + CSRF-003/004 failed due to isolated Playwright `request` fixture not sharing browser cookies after `loginViaUi`. Logout success set to exact **HTTP 200**. Runtime remains FAILED until the next workflow.

Runtime note (attempt 7): run `30689093849` (51/1/2) — session/logout/CSRF PASS; sole failure CSRF-003 **400** `createdById is required`. Payload helper + exact 201 gate added. Skips: INV list 403 (PRODUCT_GAP); prior WO lifecycle skip was create-payload-driven.

Runtime closeout (attempt 7): run `30696336211` on `0ecd3fa` — **63 passed / 0 failed / 1 skipped**. Status: **PARTIAL_RUNTIME_VALIDATION**. See `FULL_STACK_E2E_RUNTIME_EVIDENCE.md`.



## Phase 5A inventory gate

| Gate | Expectation |
| --- | --- |
| Inventory Keeper login | HTTP 200 |
| Parts list | HTTP 200 |
| Dedicated WO | created via manager BFF path |
| Stock issue | exact HTTP 200 |
| Quantity delta | deducted once |
| Duplicate key replay | no second deduction |
| Negative stock | HTTP 400 |
| Movements | HTTP 200 |


## Phase 5B work-order lifecycle

| Suite | Coverage |
| --- | --- |
| E2E-WO-LC-001..020 | Full create→approve→assign→start→parts→complete→verify |
| E2E-WO-NEG-* | Approval, assignment, CSRF, tenant negatives |
| Work-order lifecycle gate | Focused CI gate after inventory |

## Phase 5C procurement matrix

- @procurement-gate: procurement.spec.ts
- Contract self-tests: totals / approval / receiving / ERP

## Phase 5D management-info gate

Focused Playwright project grep: `@management-info-gate` (dashboard / KPI / report / audit / ERP-monitor).  
Preserve Phase 5B `fe3b3992d883d33c916b3595769add2c4db8878a` / workflow `30712469601` and Phase 5C `512745d678a4be6b0d0a62f2400763ff9fd4ec08` / workflow `30715842098`.  
Do **not** invent a Phase 5D runtime SHA until Full-Stack E2E succeeds.

### E2E-DASH — role-specific dashboards

| ID | Coverage |
| --- | --- |
| E2E-DASH-001 | Admin dashboard loads |
| E2E-DASH-002 | Management dashboard shows organization KPIs |
| E2E-DASH-003 | Technician dashboard shows only assigned work |
| E2E-DASH-004 | Inventory Keeper excludes sensitive finance/system information |
| E2E-DASH-005 | Finance dashboard shows approval/procurement summary |
| E2E-DASH-006 | Procurement dashboard shows ERP/GRN backlog |
| E2E-DASH-007 | VIEWER receives only approved read-only modules |
| E2E-DASH-008 | Unauthorized role receives exact 403 for restricted report |
| E2E-DASH-009 | Tenant B cannot see Tenant A counts |
| E2E-DASH-010 | Degraded source appears as DEGRADED, not zero |
| E2E-DASH-011 | generatedAt / range / timezone / currency metadata exist |
| E2E-DASH-012 | Drill-down filters preserve tenant/range context |

No mandatory dashboard test may `test.skip`.

### E2E-KPI — reconciliation

| ID | Coverage |
| --- | --- |
| E2E-KPI-001 | Work-order total reconciles |
| E2E-KPI-002 | Status counts reconcile (non-overlapping rules) |
| E2E-KPI-003 | Overdue count reconciles |
| E2E-KPI-004 | Approval backlog reconciles |
| E2E-KPI-005 | Verification backlog reconciles |
| E2E-KPI-006 | Technician workload reconciles (canonical assignees) |
| E2E-KPI-007 | Low-stock count reconciles |
| E2E-KPI-008 | Inventory value reconciles |
| E2E-KPI-009 | Procurement approval queues reconcile |
| E2E-KPI-010 | ERP failure/retry counts reconcile |
| E2E-KPI-011 | Partial/final receipt counts reconcile |
| E2E-KPI-012 | MTBF returns null + INSUFFICIENT_DATA when intervals insufficient (never zero) |

### E2E-REPORT — access, time/currency, finance, export

| ID | Coverage |
| --- | --- |
| E2E-REPORT-001 | Module permission allow path |
| E2E-REPORT-002 | Module permission deny → 403 |
| E2E-REPORT-003 | Invalid/inverted dates → 400; max range enforced |
| E2E-REPORT-004 | Asia/Colombo day/month boundaries |
| E2E-REPORT-005 | currencyCode LKR in metadata; numeric amounts |
| E2E-REPORT-006 | VIEWER limited modules |
| E2E-REPORT-007 | INVENTORY_KEEPER inventory/ops only |
| E2E-REPORT-008 | system_logs requires audit.view |
| E2E-REPORT-010 | Default Total Expenses = consumed WO actualCost + utility + farm |
| E2E-REPORT-011 | Parts excluded when actualCost present |
| E2E-REPORT-012 | Committed PO spend is a separate card |
| E2E-REPORT-020 | CSV/XLSX formula neutralization (=+ -@ tab CR) |
| E2E-REPORT-021 | Export needs module view + reports.export |
| E2E-REPORT-022 | Truncation metadata when capped |
| E2E-REPORT-023 | Export writes audit event |

### E2E-AUDIT — security and lifecycle coverage

| ID | Coverage |
| --- | --- |
| E2E-AUDIT-001 | Role/permission change events |
| E2E-AUDIT-002 | Login failure persisted safely (no password/token) |
| E2E-AUDIT-003 | WO / inventory / PO / ERP lifecycle coverage |
| E2E-AUDIT-004 | Report and audit exports audited |
| E2E-AUDIT-005 | Invalid audit dates → 400 |

### E2E-ERP-MON — safe monitoring

| ID | Coverage |
| --- | --- |
| E2E-ERP-MON-001 | Safe ERP summary for management/procurement |
| E2E-ERP-MON-002 | Inventory Keeper cannot erp_apply |
| E2E-ERP-MON-003 | No URL / payload / key leakage |
| E2E-ERP-MON-004 | MOCK provider only in E2E |

Contract self-tests: KPI catalog invariants, financial double-count prevention, export neutralization, report date/currency bounds.

## Phase 6A — recovery rehearsal

| Suite | IDs | Gate |
| --- | --- | --- |
| Recovery E2E | DR-E2E-001..025 | `@recovery-gate` — mandatory skipped=0 |
| Integrity | DR-INTEGRITY-001..006 | Contract + CI step |
| Object storage | DR-OBJECT-001..007 | E2E MinIO disposable buckets |

See `DISASTER_RECOVERY_TEST_MATRIX.md` for per-ID assertions.

**Phase 6A runtime:** `RECOVERY_RUNTIME_VALIDATED` — SHA `baad89621c87ddd4b840bb9c77cb20efcb1b79b6` / workflow `30735445667` / full suite 103/0/0.

Preserve Phase 5B `fe3b3992d883d33c916b3595769add2c4db8878a` / `30712469601`; Phase 5C `512745d678a4be6b0d0a62f2400763ff9fd4ec08` / `30715842098`; Phase 5D `5836bc330cc03e7a3f658ed9cee5f334649f3091` / `30719294386`.

## Phase 6B - operations / failure / queue matrix

| Suite | IDs | Gate | Assertions (summary) |
| --- | --- | --- | --- |
| Operations | E2E-OPS-001..015 | @ops-gate | live 200; ready 200 for CI; correlation generate/validate/echo; readiness 403 without auth; build-info SHA present in disposable stack; metrics forbidden-label self-check when exporter present |
| Failure / shutdown | E2E-FAIL-001..010 | @ops-gate | SIGTERM drain; ready=503 while shutting down; exit within grace; restart to ready; Mongo down => ready 503 and live 200; no restart-loop when ready would flap |
| Queue reconcile | E2E-QUEUE-001..010 | @ops-gate | Policy B; Redis cold start; stable job IDs; idempotent second reconcile; ready waits or documented degrade |

See contracts: HEALTH_AND_READINESS_CONTRACT.md, REQUEST_CORRELATION_CONTRACT.md, QUEUE_STARTUP_RECONCILIATION_CONTRACT.md, GRACEFUL_SHUTDOWN_CONTRACT.md, STARTUP_AND_RESTART_CONTRACT.md.

**Phase 6B runtime:** **OPERATIONS_RUNTIME_VALIDATED** — SHA `dfcb136edf1ca6ecf8aff94fe892418c0d40d0cd` / workflow `30737905003` / ops gate 11/0/0 / rehearsal success / full suite 103/0/0.

**Host reboot:** Not part of CI matrix - OPERATOR_ACTION_REQUIRED via HOST_REBOOT_RECOVERY_RUNBOOK.md; never equate E2E-FAIL container restart to HOST_REBOOT_VALIDATED.

Preserve Phase 5B fe3b3992d883d33c916b3595769add2c4db8878a / 30712469601; Phase 5C 512745d678a4be6b0d0a62f2400763ff9fd4ec08 / 30715842098; Phase 5D 5836bc330cc03e7a3f658ed9cee5f334649f3091 / 30719294386; Phase 6A baad89621c87ddd4b840bb9c77cb20efcb1b79b6 / 30735445667 RECOVERY_RUNTIME_VALIDATED; Phase 6B dfcb136edf1ca6ecf8aff94fe892418c0d40d0cd / 30737905003 OPERATIONS_RUNTIME_VALIDATED.

## Phase 6C - production security hardening

**Status:** SOURCE_IMPLEMENTED — runtime pending; not PRODUCTION_SECURITY_VALIDATED.
**Prerequisite:** Phase 6B OPERATIONS_RUNTIME_VALIDATED (`dfcb136` / `30737905003`).
**Port owner:** PORT_OWNER_DECISION_REQUIRED.
**Mongo root rotation:** OPERATOR_OWNED_P0 — never auto-rotated.

Preserve Phase 5B/5C/5D/6A/6B evidence SHAs unchanged.
