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
| Runtime status | **FUNCTIONAL_RUNTIME_VALIDATED** (see cleanup safety section) |

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

## Phase 5B CI cleanup safety closeout (pending corrected rerun)

| Field | Value |
| --- | --- |
| Functional workflow | `30703557700` |
| Functional tested application SHA | `15d28f35f4c3ab23dd851b6a7ea232678f47a2ae` |
| Functional totals | 103 passed / 0 failed / 0 skipped |
| Functional status | **FUNCTIONAL_RUNTIME_VALIDATED** |
| Safety defect class | `CI_CLEANUP_SAFETY_DEFECT` / `DESTRUCTIVE_AUTOMATION_POLICY_VIOLATION` |
| Defect | Workflow cleanup used `down --volumes` (project-scoped volume deletion) |
| Correction | `down --remove-orphans` only; volumes preserved; ephemeral runner disposal |
| Phase 5B safety status | **CI_CLEANUP_SAFETY_PENDING** until corrected SHA workflow succeeds |
| Phase 5C | Blocked until corrected workflow succeeds |
