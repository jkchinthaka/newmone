# Defect Register — Final Acceptance

**Phase 1:** `maintainpro/final-acceptance-validation` (PR #43)
**Phase 2:** `maintainpro/final-acceptance-phase2`

| ID | Module | Sev | Steps | Expected | Actual | Root cause | Files | Fix | Retest | Status |
|----|--------|-----|-------|----------|--------|------------|-------|-----|--------|--------|
| FA-001 | Maintenance requests / RBAC | P1 | MANAGER create request | 201 | 403 | permission alias gap | `permissions.guard.ts`, seed | aliases + seed | PASS | CLOSED |
| FA-002 | Maintenance requests / SQL | P1 | 2nd unconverted request | 201 | 409 | nullable unique | filtered unique migration | filtered index | PASS | CLOSED |
| FA-003 | Planning / PM create | P1 | POST `/planning/pm-plans` | 201 | 503 DATABASE_UNAVAILABLE | `snapshot` Object vs String; filter misclassified Prisma validation | `planning.service.ts`, `http-exception.filter.ts` | JSON.stringify snapshot; exclude ValidationError from 503 | Phase2 PM create PASS | CLOSED |

## Previously remediated (PR #42)

Action Center aggregates, facility 403 routing, finance/procurement content, timeout parsing, nav badge RBAC — do not re-open without regression evidence.
