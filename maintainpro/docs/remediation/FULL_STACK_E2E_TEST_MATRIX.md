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
| E2E-INV-001..008 | Inventory | Stock issue + negative rejection |
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

