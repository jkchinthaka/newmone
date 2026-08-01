# Full-Stack E2E Runtime Evidence

**Document type:** Safe runtime closeout metadata only (no secrets, tokens, cookies, or raw logs).
**Phase:** 4B controlled remediation — Attempt 7 closeout

## Workflow

| Field | Value |
| --- | --- |
| Workflow name | Full-Stack E2E |
| Workflow run ID | `30696336211` |
| Branch | `test/phase4-full-stack-e2e-qa` |
| Exact tested application SHA | `0ecd3fa58fcd18c618ef6ffab69b6ebfbf162ad5` |
| Start (UTC) | 2026-08-01T10:45:42Z |
| Completion (UTC) | 2026-08-01T10:52:46Z |
| Runner OS | ubuntu-latest (GitHub Actions) |
| Workflow conclusion | **success** |

## Prior attempt context

| Field | Value |
| --- | --- |
| Previous run | `30689093849` |
| Previous totals | 51 passed / 1 failed / 2 skipped |
| Previous sole failure | E2E-CSRF-003 → HTTP 400 `VALIDATION_ERROR` / `createdById is required` |
| Classification | `TEST_PAYLOAD_CONTRACT_DEFECT` / `WORK_ORDER_CREATE_CONTRACT_MISMATCH` |

## Service health summary

| Gate | Result |
| --- | --- |
| Disposable stack build/start | PASS |
| Health wait (API/Web/Nginx) | PASS |
| Seed disposable data | PASS |
| Cleanup (project-scoped stop) | PASS |
| Auth-path probes A/B/C | **200 / 200 / 200** (`AUTH-PATH-DIAG PASS`) |
| Session CSRF diagnostic | PASS |
| Work-order create gate | PASS (`create_status=201`, read-back 200) |
| Full Playwright suite | PASS |

## Playwright totals (JUnit)

| Metric | Count |
| --- | --- |
| Tests | 64 |
| Passed | 63 |
| Failed | 0 |
| Skipped | 1 |

## Skipped tests

| Test ID | Reason | Classification |
| --- | --- | --- |
| E2E-INV-001..005 stock display and issue controls | Inventory list unavailable (**403**) — product/route gap | `PRODUCT_GAP` / `OPTIONAL_FEATURE_NOT_IMPLEMENTED` |

Not critical security skips. Auth, CSRF, logout, RBAC, tenant isolation, and work-order create all executed and passed.

## Work-order create result

| Check | Result |
| --- | --- |
| Focused create gate | PASS |
| E2E-CSRF-003 | PASS (exact **201**) |
| Created record ID present | yes |
| Read-back | **200** |
| Tenant B cross-read | blocked (403/404) |

## Artifact names (uploaded)

- `full-stack-e2e-evidence` (includes Playwright HTML report, JUnit XML, evidence manifest, redacted compose/auth-path logs)

## Artifact security review

| Check | Result |
| --- | --- |
| Passwords in artifacts | Not observed (redaction patterns present where applicable) |
| Access/refresh token values | Not observed in reviewed safe summaries |
| CSRF/cookie values | Not observed (cookie **names** only in auth-path diag) |
| Authorization headers | Not observed |
| Credential-bearing DB URLs | Not observed |
| Production hosts/IPs | Not observed (loopback E2E only) |

Raw artifacts were **not** committed to git.

## Remaining limitations

1. Live production login is **not** validated by this suite.
2. MongoDB root rotation remains **operator-owned** (unchanged).
3. Inventory stock display/issue path returns 403 for the seeded inventory keeper — optional ERP control gap (Phase 5+).
4. Full work-order lifecycle (assign/status progression) remains Phase 5 scope.
5. Client-supplied `createdById` vs authenticated actor attribution remains **P1 BUSINESS_CONTRACT_REVIEW**.
6. CI latency thresholds are disposable-environment smoke only.

## Runtime status decision

**PARTIAL_RUNTIME_VALIDATION**

Rationale:

- Workflow success on exact SHA `0ecd3fa58fcd18c618ef6ffab69b6ebfbf162ad5`
- All mandatory authentication, logout, CSRF, RBAC, tenant, and work-order create tests passed
- Cleanup succeeded
- Artifact security review passed for safe metadata
- Exactly one optional inventory product-gap skip remains

Do **not** treat as production go-live ready. Do **not** mark live production login validated.
