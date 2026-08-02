# Full-Stack E2E Runtime Evidence

**Document type:** Safe runtime closeout metadata only (no secrets, tokens, cookies, or raw logs).

## Phase 5A — Inventory access and stock issue controls

| Field | Value |
| --- | --- |
| Workflow name | Full-Stack E2E |
| Workflow run ID | `30698756592` |
| Branch | `fix/phase5a-inventory-access-controls` |
| Exact tested application SHA | `e41d7ab25da9c7ad901a93993627449c1a240b99` |
| Runner OS | ubuntu-latest (GitHub Actions) |
| Workflow conclusion | **success** |
| Runtime status | **RUNTIME_VALIDATED** |

### Inventory access decision

- Classification: `RBAC_ROUTE_CONTRACT_DEFECT` (keeper omitted from read `@Roles`)
- Model selected: **Option A** — add `INVENTORY_KEEPER` to `INVENTORY_READ_ROLES`; keep `inventory.manage` / `inventory.stock_issue`
- Stock-out: requires tenant-scoped `workOrderId`; success status **200**; atomic conditional decrement; tenant-scoped idempotency

### Focused inventory gate

| Check | Result |
| --- | --- |
| Inventory controls gate step | PASS |
| Keeper login | 200 |
| Parts list | 200 |
| Dedicated WO / gate part | available |
| Stock issue | 200 |
| Quantity delta once | yes |
| Duplicate prevented | yes |
| Negative stock | 400 |
| Movements | 200 |

### Playwright totals (JUnit)

| Metric | Count |
| --- | --- |
| Passed | 78 |
| Failed | 0 |
| Skipped | 0 |

### Inventory suite (E2E-INV-001..016)

All mandatory inventory controls **passed** with **0 skips**.

### Artifact security review

| Check | Result |
| --- | --- |
| Passwords in artifacts | Not observed (redaction patterns present) |
| Access/refresh token values | Not observed in safe summaries |
| CSRF/cookie values | Not observed (cookie names only where applicable) |
| Authorization headers | Not observed |
| Credential-bearing DB URLs | Not observed |
| Raw artifacts committed to git | **No** |

### Cleanup

Isolated E2E Compose project stopped (project-scoped stop only).

### Remaining limitations (not Phase 5A blockers)

1. Live production login remains unvalidated.
2. MongoDB root rotation remains operator-owned.
3. `createdById` attribution P1 remains separate.
4. ERP apply role narrowing for keeper remains P1 follow-on.
5. Do **not** treat as production go-live readiness.

---

## Phase 4B closeout (prior)

| Field | Value |
| --- | --- |
| Workflow run ID | `30696336211` |
| Exact tested application SHA | `0ecd3fa58fcd18c618ef6ffab69b6ebfbf162ad5` |
| Evidence-document commit | `e69cca42ed1e3fee7046c7549c22bc8c30988499` |
| Totals | 63 passed / 0 failed / 1 skipped |
| Prior status | PARTIAL_RUNTIME_VALIDATION (inventory keeper 403 skip) |

Phase 5A supersedes the inventory skip with RUNTIME_VALIDATED for the Phase 5A commit above.

## Phase 5B — Work-order lifecycle (approval through supervisor verification)

| Field | Value |
| --- | --- |
| Workflow name | Full-Stack E2E |
| Workflow run ID | `30703557700` |
| Branch | `fix/phase5b-work-order-lifecycle` |
| Exact tested application SHA | `15d28f35f4c3ab23dd851b6a7ea232678f47a2ae` |
| Runner OS | ubuntu-latest (GitHub Actions) |
| Workflow conclusion | **success** |
| Runtime status | **RUNTIME_VALIDATED** |

### Lifecycle contract (safe summary)

- Operational `status` and `approvalStatus` remain separate dimensions.
- Maker-checker: creator cannot self-approve (403); separate admin/manager approves.
- `createdById` authoritative from authenticated actor (create-on-behalf limited).
- Assignment: `POST /assign` syncs legacy `technicianId` + `WorkOrderAssignee`.
- Start requires APPROVED + assignment; hold requires `delayReason`.
- Evidence: photo requirements waived when storage uploads disabled; completion note mandatory.
- Technician completion maps to `TECHNICIAN_COMPLETED`; supervisor `verify-supervisor` finalizes `COMPLETED`.
- Phase 5A inventory stock-out controls preserved and reused in lifecycle.

### Focused work-order lifecycle gate

| Check | Result |
| --- | --- |
| Lifecycle gate step | PASS (1 test on chromium-gate) |
| create_status | 201 |
| approval_status | APPROVED |
| assignment_present | yes |
| start_status | 200 |
| stock_issue_status | 200 |
| evidence present | yes (note metadata; photos waived when storage off) |
| technician_completion_status | 200 |
| supervisor_verification_status | 200 |
| final_status | COMPLETED |
| history_ok | yes |
| tenant_isolation | yes |

### Playwright totals (full suite)

| Metric | Count |
| --- | --- |
| Passed | 103 |
| Failed | 0 |
| Skipped | 0 |

### Artifact security review

| Check | Result |
| --- | --- |
| No passwords/tokens/cookies/CSRF/Authorization in evidence docs | PASS |
| No raw Playwright reports committed | PASS |
| Cleanup / disposable stack stop | PASS |

### Remaining blockers (not Phase 5B)

- Phase 5C: procurement / purchase-order lifecycle
- Phase 5D: broader dashboard/report reflection polish; ERP apply role narrowing
- Flutter client: status-set coverage incomplete (OPERATOR_ACTION_REQUIRED if Dart changes needed without tooling)
- Production go-live: not claimed

## Phase 5B CI cleanup safety closeout

| Field | Value |
| --- | --- |
| Prior functional workflow | 30703557700 |
| Prior functional tested SHA | 15d28f35f4c3ab23dd851b6a7ea232678f47a2ae |
| Prior functional totals | 103 passed / 0 failed / 0 skipped |
| Safety defect class | CI_CLEANUP_SAFETY_DEFECT / DESTRUCTIVE_AUTOMATION_POLICY_VIOLATION |
| Correction commit | fe3b3992d883d33c916b3595769add2c4db8878a |
| Corrected workflow run ID | 30712469601 |
| Exact tested corrected SHA | fe3b3992d883d33c916b3595769add2c4db8878a |
| Corrected totals | 103 passed / 0 failed / 0 skipped |
| Lifecycle gate | PASS |
| Cleanup command | docker compose ... down --remove-orphans |
| Volume deletion | none (no -v / --volumes / volume rm / prune) |
| Cleanup result | PASS (containers + project network removed; volumes preserved) |
| Nondestructive validator in CI | PASS |
| Artifact security review | PASS |
| Final Phase 5B status | **RUNTIME_VALIDATED** |
| Phase 5C | Unblocked for start after this closeout |

## Phase 5C procurement RUNTIME_VALIDATED

| Field | Value |
|---|---|
| Runtime status | **RUNTIME_VALIDATED** |
| Branch | fix/phase5c-procurement-po-erp-controls |
| Exact tested application SHA | 512745d678a4be6b0d0a62f2400763ff9fd4ec08 |
| Workflow run ID | 30715842098 |
| Procurement gate | PASS (20 passed) |
| Full Playwright suite | 103 passed / 0 failed / 0 skipped |
| ERP provider | MOCK |
| Cleanup | down --remove-orphans (volumes preserved) |
| Phase 5B preserved | fe3b3992d883d33c916b3595769add2c4db8878a / 30712469601 / 103/0/0 |

Safe gate flags: request/PO/approval/ERP/receipt/stock/duplicate-prevention/audit/tenant controls exercised via @procurement-gate.
Evidence-document commits after this SHA are documentation-only unless labeled otherwise.

## Phase 5D — Management dashboard, reports, audit, ERP monitoring

| Field | Value |
| --- | --- |
| Workflow name | Full-Stack E2E |
| Workflow run ID | `30719294386` |
| Branch | `fix/phase5d-dashboard-report-audit-controls` |
| Exact tested application SHA | `5836bc330cc03e7a3f658ed9cee5f334649f3091` |
| Runner OS | ubuntu-latest (GitHub Actions) |
| Workflow conclusion | **success** |
| Runtime status | **RUNTIME_VALIDATED** |
| Reporting timezone | Asia/Colombo |
| Currency code | LKR |
| ERP provider (E2E) | MOCK |

### Management-information gate (@management-info-gate)

| Check | Result |
| --- | --- |
| Management information gate | PASS (20 passed / 0 failed / 0 skipped) |
| Dashboard role matrix | PASS |
| KPI reconciliation (WO total, MTBF insufficient-data) | PASS |
| Financial / report access | PASS (authorized 200 / unauthorized 403) |
| Export safety | PASS |
| Audit soft checks / failed-login non-leakage | PASS |
| ERP monitoring safe summary | PASS |
| Tenant isolation | PASS |

### Prior gates in same workflow

| Gate | Result |
| --- | --- |
| Text integrity / nondestructive cleanup / secret safety | PASS |
| Work-order / inventory / lifecycle / procurement gates | PASS |
| Full Playwright suite | 103 passed / 0 failed / 0 skipped |
| Cleanup | down --remove-orphans (volumes preserved) |

### Preserved prior evidence

| Phase | Application SHA | Workflow | Totals |
| --- | --- | --- | --- |
| 5B | fe3b3992d883d33c916b3595769add2c4db8878a | 30712469601 | 103 / 0 / 0 |
| 5C | 512745d678a4be6b0d0a62f2400763ff9fd4ec08 | 30715842098 | procurement 20; full 103 / 0 / 0 |

### Artifact security review

| Check | Result |
| --- | --- |
| Passwords / tokens / cookies / CSRF / Authorization | Not observed in safe summaries |
| ERP provider URLs / payloads / keys | Not observed |
| Raw artifacts committed | **No** |

### Remaining blockers (not Phase 5D)

1. Phase 6 backup / monitoring infrastructure.
2. Production role / permission migration for new `reports.*` keys (operator-owned).
3. Flutter dashboard redesign (out of scope).
4. Production go-live / IIS / DNS / Azure changes (out of scope).
5. Do **not** treat as production go-live readiness.

Evidence-document commits after `5836bc330cc03e7a3f658ed9cee5f334649f3091` are documentation-only unless labeled otherwise.

## Phase 6A — Backup / restore / disaster-recovery rehearsal

| Field | Value |
| --- | --- |
| Workflow name | Full-Stack E2E |
| Workflow run ID | `30735445667` |
| Branch | `fix/phase6a-backup-restore-recovery` |
| Exact tested application SHA | `baad89621c87ddd4b840bb9c77cb20efcb1b79b6` |
| Runner OS | ubuntu-latest (GitHub Actions) |
| Workflow conclusion | **success** |
| Runtime status | **RECOVERY_RUNTIME_VALIDATED** |
| Production DR status | **not claimed** (not `PRODUCTION_DR_VALIDATED`) |
| ERP provider (E2E) | MOCK |
| Timing label | `E2E_SMOKE_ONLY_NOT_CAPACITY_EVIDENCE` |

### Recovery gate (safe summary)

| Check | Result |
| --- | --- |
| recovery_mode | e2e |
| source_safe | yes |
| target_fresh | yes (`maintainpro_restore_*`) |
| backup_id_alias | `e2e-backup-ci-30735445667-1937e245` |
| backup_status | success |
| checksum_status | valid |
| corruption_rejected | yes |
| restore_status | success |
| collection_reconciliation | pass |
| recovery_api_health | 200 |
| recovery_login | 200 |
| application_smoke_status | pass |
| object_reconciliation | pass |
| recovery_duration_seconds | 11 |
| raw_archive_uploaded | no |
| volumes_removed | no |

### Prior gates in same workflow

| Gate | Result |
| --- | --- |
| Recovery safety / text integrity / nondestructive cleanup / secret safety | PASS |
| Management-information gate | 20 passed / 0 failed / 0 skipped |
| Full Playwright suite | 103 passed / 0 failed / 0 skipped |
| Cleanup | `down --remove-orphans` (volumes preserved) |

### Preserved prior evidence

| Phase | Application SHA | Workflow | Totals |
| --- | --- | --- | --- |
| 5B | fe3b3992d883d33c916b3595769add2c4db8878a | 30712469601 | 103 / 0 / 0 |
| 5C | 512745d678a4be6b0d0a62f2400763ff9fd4ec08 | 30715842098 | procurement 20; full 103 / 0 / 0 |
| 5D | 5836bc330cc03e7a3f658ed9cee5f334649f3091 | 30719294386 | management-info 20; full 103 / 0 / 0 |

### Artifact security review

| Check | Result |
| --- | --- |
| Passwords / tokens / cookies / CSRF / Authorization | Not observed in safe summaries |
| Database URIs / MinIO keys / archive bytes | Not observed / not uploaded |
| Raw Mongo archives or object payloads as CI artifacts | **No** (`raw_archive_uploaded=no`) |
| Raw artifacts committed to git | **No** |

### Remaining blockers (not Phase 6A mechanics)

1. Off-host production backup + G5.1 counted restore drill — **OPERATOR_ACTION_REQUIRED**.
2. RPO/RTO / retention — **PROVISIONAL** / **MANAGEMENT_APPROVAL_REQUIRED**.
3. Redis queue reconciler — addressed in Phase 6B (`redis_reconciled=yes` on `dfcb136` / `30737905003`); production on-call channels remain operator-owned.
4. Production Mongo root rotation — **OPERATOR_OWNED_P0**.
5. Do **not** treat as production DR or go-live readiness.

Evidence-document commits after `baad89621c87ddd4b840bb9c77cb20efcb1b79b6` are documentation-only unless labeled otherwise.

## Phase 6B — Monitoring / alerting / restart recovery

| Field | Value |
| --- | --- |
| Workflow name | Full-Stack E2E |
| Workflow run ID | `30737905003` |
| Branch | `fix/phase6b-monitoring-alerting-restart` |
| Exact tested application SHA | `dfcb136edf1ca6ecf8aff94fe892418c0d40d0cd` |
| Runner OS | ubuntu-latest (GitHub Actions) |
| Workflow conclusion | **success** |
| Runtime status | **OPERATIONS_RUNTIME_VALIDATED** |
| Production operations status | **not claimed** (not `PRODUCTION_OPERATIONS_VALIDATED`) |
| Host reboot status | **OPERATOR_ACTION_REQUIRED** (not `HOST_REBOOT_VALIDATED`) |
| ERP provider (E2E) | MOCK |
| Real notifications sent | **no** |

### Operations Playwright gate (`@operations-gate`)

| Check | Result |
| --- | --- |
| E2E-OPS-001 live 200 | PASS |
| E2E-OPS-002 ready 200 | PASS |
| E2E-OPS-003 detailed readiness unauthorized | PASS |
| E2E-OPS-004 admin readiness 200 | PASS |
| E2E-OPS-005 request id returned | PASS |
| E2E-OPS-006 invalid request id safe | PASS |
| E2E-OPS-009 metrics unauthorized | PASS |
| E2E-OPS-011 soft alerts evaluate | PASS |
| E2E-OPS-012 soft alerts list | PASS |
| E2E-OPS-013 soft metrics after login | PASS |
| E2E-OPS-014 soft queue reconciliation status | PASS |
| Gate totals | **11 passed / 0 failed / 0 skipped** |

### Exact-service restart and dependency recovery rehearsal

| Check | Result |
| --- | --- |
| liveness_status | 200 |
| readiness_status | 200 |
| request_correlation | pass |
| api_restart | pass |
| web_restart | pass |
| nginx_restart | pass |
| mongo_outage_detected | yes |
| mongo_recovered | yes |
| redis_outage_detected | yes |
| redis_reconciled | yes |
| minio_outage_detected | yes |
| minio_recovered | yes |
| data_persisted | yes |
| volumes_removed | no |
| real_notifications_sent | no |
| operations_rehearsal_status | **success** |

### Prior gates in same workflow

| Gate | Result |
| --- | --- |
| Operations / recovery / text / nondestructive / secret safety validators | PASS |
| Backup / restore / disaster-recovery rehearsal | PASS (volumes_removed=no) |
| Management-information gate | PASS |
| Full Playwright suite | **103 passed / 0 failed / 0 skipped** |
| Cleanup | `down --remove-orphans` (volumes preserved) |

### Preserved prior evidence

| Phase | Application SHA | Workflow | Status |
| --- | --- | --- | --- |
| 5B | fe3b3992d883d33c916b3595769add2c4db8878a | 30712469601 | RUNTIME_VALIDATED |
| 5C | 512745d678a4be6b0d0a62f2400763ff9fd4ec08 | 30715842098 | RUNTIME_VALIDATED |
| 5D | 5836bc330cc03e7a3f658ed9cee5f334649f3091 | 30719294386 | RUNTIME_VALIDATED |
| 6A | baad89621c87ddd4b840bb9c77cb20efcb1b79b6 | 30735445667 | RECOVERY_RUNTIME_VALIDATED |

### Artifact security review

| Check | Result |
| --- | --- |
| Passwords / tokens / cookies / CSRF / Authorization | Not observed in safe summaries |
| Database / Redis URIs / provider credentials | Not observed in safe summaries |
| Real notification recipients | **no** |
| Raw artifacts committed to git | **No** |
| Artifact upload | safe evidence only (`full-stack-e2e-evidence`) |

### Remaining blockers (not Phase 6B isolated-CI mechanics)

1. Host reboot drill (G5.2) — **OPERATOR_ACTION_REQUIRED** (Linux/Docker and Windows Server).
2. Alert thresholds / on-call routing — **PROVISIONAL** / **OPERATOR_APPROVAL_REQUIRED**.
3. Off-host log retention / G5.3 disk evidence — **PROVISIONAL** / **MANAGEMENT_APPROVAL_REQUIRED**.
4. Real PagerDuty/Teams/Slack/SMS escalation — **out of scope** (mock/UAT only in Phase 6B).
5. Do **not** treat as `PRODUCTION_OPERATIONS_VALIDATED` or production go-live readiness.

Evidence-document commits after `dfcb136edf1ca6ecf8aff94fe892418c0d40d0cd` are documentation-only unless labeled otherwise.

## Phase 6C — Production configuration and security hardening

| Field | Value |
| --- | --- |
| Workflow name | Full-Stack E2E |
| Workflow run ID | `30738838804` |
| Branch | `fix/phase6c-production-security-hardening` |
| Exact tested application SHA | `205d2d23825ff0959310b3a6735b58dff88f1858` |
| Workflow conclusion | **success** |
| Runtime status | **SECURITY_RUNTIME_VALIDATED** |
| Production security status | **not claimed** (not `PRODUCTION_SECURITY_VALIDATED`) |
| Port owner | **PORT_OWNER_DECISION_REQUIRED** |
| Real notifications sent | **no** |
| Volumes removed | **no** |

### Security gate (safe summary)

| Check | Result |
| --- | --- |
| config_contract | pass |
| secret_policy | pass |
| cookie_https_contract | pass |
| cors_contract | pass |
| port_ownership_contract | decision_required |
| network_exposure | pass |
| readiness_protection | pass |
| swagger_policy | pass |
| privileged_role_matrix | pass |
| signoff_role_spoofing | blocked |
| container_hardening | pass |
| production_mutation_performed | no |
| security_gate_status | **success** |

### Prior gates in same workflow

| Gate | Result |
| --- | --- |
| Operations / recovery / secret / text validators | PASS |
| Ops Playwright gate | 11 passed / 0 failed / 0 skipped |
| Exact-service rehearsal | success (`volumes_removed=no`) |
| Full Playwright suite | 102 passed / 0 failed / 0 skipped / 1 flaky (retried pass) |
| Cleanup | `down --remove-orphans` |

### Remaining operator blockers (not fixture mechanics)

1. PORT_OWNER_DECISION_REQUIRED (Nginx vs IIS).
2. HTTPS certificate / live domain — OPERATOR_ACTION_REQUIRED.
3. Mongo root rotation — OPERATOR_OWNED_P0.
4. Production permission migration apply — OPERATOR (dry-run only in CI).
5. Off-host production backup/restore drill — OPERATOR.
6. Do **not** treat as production go-live readiness.

Evidence-document commits after `205d2d23825ff0959310b3a6735b58dff88f1858` are documentation-only unless labeled otherwise.

## Phase 7 — UAT / training / rollback / go-live decision controls

| Field | Value |
| --- | --- |
| Workflow name | Full-Stack E2E |
| Workflow run ID | `30739452422` |
| Branch | `test/phase7-uat-go-live-decision` |
| Exact tested application SHA | `95cd576cab29482e1b6e307053290aced62d33de` |
| Workflow conclusion | **success** |
| Technical runtime status | **UAT_CONTROL_RUNTIME_VALIDATED** |
| Formal business UAT | **FORMAL_UAT_PENDING** |
| Formal training | **FORMAL_TRAINING_PENDING** |
| Management sign-off | **MANAGEMENT_SIGNOFF_PENDING** |
| Recommendation | **DELAYED** |
| Human decision | **PENDING_AUTHORIZED_HUMAN_DECISION** |
| Phase 8 | **not executed** |
| Volumes removed | **no** |
| Production deployment | **no** |

### UAT control gate

| Check | Result |
| --- | --- |
| uat_mechanics | pass |
| synthetic_excluded_from_formal | yes |
| training_mechanics | pass |
| rollback_rehearsal | pass (`ROLLBACK_REHEARSAL_VALIDATED`) |
| signoff_authorization | pass |
| recommended_decision | **DELAYED** |
| uat_control_gate_status | **success** |

### Full suite

| Totals | 103 passed / 0 failed / 0 skipped |

### Exact blockers preventing GO_FOR_CUTOVER

1. Formal business UAT incomplete
2. Formal training attendance/competency incomplete
3. PORT_OWNER_DECISION_REQUIRED
4. Production HTTPS certificate evidence missing
5. Production off-host backup/restore drill missing
6. Production permission migration apply pending (dry-run only in CI)
7. Mongo root rotation still OPERATOR_OWNED_P0
8. Management sign-offs not completed by authorized humans
9. Phase 8 deployment approval absent

Evidence-document commits after `95cd576cab29482e1b6e307053290aced62d33de` are documentation-only unless labeled otherwise.

## Phase 7A — release candidate test stability

| Field | Value |
| --- | --- |
| Workflow name | Full-Stack E2E |
| Workflow run ID | `30740626683` |
| Branch | `fix/phase7a-release-candidate-stability` |
| Exact tested application SHA | `5e3c470f3d7bc2fa15d84252db6492b7c4b65522` |
| Workflow conclusion | **success** |
| Technical runtime status | **RELEASE_CANDIDATE_TEST_STABILITY_VALIDATED** |
| Focused gate (E2E-AUTH-012) | 20 passed (10 chromium-desktop + 10 mobile-smoke) / 0 failed / 0 skipped |
| Focused retries | **0** |
| Full Playwright suite | 103 passed / 0 failed / 0 skipped / 0 flaky |
| Recommendation | **DELAYED** (unchanged) |
| Phase 8 | **not executed** |
| Cleanup | `docker compose -p "$COMPOSE_PROJECT_NAME" --env-file .env.e2e -f docker-compose.yml -f docker-compose.e2e.yml down --remove-orphans` |
| Volumes removed | **no** |
| Artifact security | no password/token/cookie/CSRF/Authorization/DB URI values observed in uploaded evidence |
| Production deployment | **no** |

### Root cause (confirmed)

Client-side dashboard session redirect (`router.replace("/login?reason=session_expired")` in `app/(dashboard)/layout.tsx`) can abort Playwright `page.goto("/work-orders")` after logout, producing `net::ERR_ABORTED` (especially mobile-smoke). Not a middleware/auth product defect.

### Remaining operator/human blockers (unchanged)

1. FORMAL_UAT_PENDING
2. FORMAL_TRAINING_PENDING
3. MANAGEMENT_SIGNOFF_PENDING
4. PORT_OWNER_DECISION_REQUIRED
5. Production HTTPS evidence pending
6. Production off-host backup drill pending
7. Production permission apply pending
8. Mongo root rotation OPERATOR_OWNED_P0
9. Phase 8 approval absent

Evidence-document commits after `5e3c470f3d7bc2fa15d84252db6492b7c4b65522` are documentation-only unless labeled otherwise.