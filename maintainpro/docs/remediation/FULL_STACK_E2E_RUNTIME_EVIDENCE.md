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
