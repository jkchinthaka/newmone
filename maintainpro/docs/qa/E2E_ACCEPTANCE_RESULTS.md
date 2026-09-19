# E2E Acceptance Results

**Phase 1 branch:** `maintainpro/final-acceptance-validation` (merged PR #43 `ad4ec4e2`)
**Phase 2 branch:** `maintainpro/final-acceptance-phase2`
**Stack:** Docker compose dev (API :3000, Web :3001, SQL :14333, Redis, MinIO)

## Phase 2 automated journeys (`scripts/verify-phase2-journeys.mjs`)

| Gate | Result |
|------|--------|
| Auth | PASS |
| Request create → convert WO (regression) | PASS |
| WO Create→Plan→Assign→Start→Hold→Resume→QR→Complete→Verify→Close | PASS |
| WO history + terminal CLOSED | PASS |
| Invalid transition from CLOSED | PASS |
| Unauthorized verify (tech) | PASS |
| WO cancel | PASS |
| Inventory stock-in / stock-out / adjust | PASS |
| Stock count create → post + duplicate reject | PASS |
| PM plan create + auto-wo + due-work | PASS |
| Procurement PO list | PASS |
| Fleet + gate eligibility | PASS |
| Work permits + approvals inbox + reliability policy | PASS |
| SoD tech cannot approve | PASS |
| Queues warm + Action Center | PASS |
| **Summary** | **35/35 PASS** |

## Database integrity

| Gate | Result | Notes |
|------|--------|-------|
| Fresh empty DB migrate + seed ×2 | PASS | users/roles/permissions/parts identical; 0 duplicate role names |
| Upgrade forward migrate | PASS | marker SparePart qty=7 preserved; 17 migrations |
| Backup → restore other DB | PASS | Tenant/User/Role/WO/MR/Part/migrations counts match |

## Security / a11y smoke

| Gate | Result |
|------|--------|
| `verify-phase2-security.mjs` | 8/8 PASS |
| `verify-phase2-a11y.mjs` | 9/9 PASS (SSR main/h1 landmarks still thin — lower severity) |

## Prior Phase 1 (preserved)

| Gate | Result |
|------|--------|
| Request→WO FA journey | PASS (PR #43) |
| FA-001 / FA-002 | CLOSED |
| Action Center aggregates | PASS |
| API Jest / typecheck (PR #43) | PASS |

## Remaining (external / operator)

Responsive visual matrix, hosted PWA registration, live Bileeta/Entra/SMTP, human UAT — see `FINAL_HANDOVER_REPORT.md`.
