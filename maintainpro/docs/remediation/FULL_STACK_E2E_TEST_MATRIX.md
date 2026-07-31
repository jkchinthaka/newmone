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