# Save check results

Stack: web `http://127.0.0.1:3041`, API `http://127.0.0.1:3040` (`fix/sweep-e2e-tenant` `949daea2`), database `maintainpro_e2e_wo_verify`. Playwright `E2E_TEST_MODE=true`. New spec: `apps/web/e2e-real/save-gaps.spec.ts`. `main` was not changed.

## Coverage map

| Flow | Covered by | Save | Reload | DB row | Double submit | Gap filled by |
| --- | --- | --- | --- | --- | --- | --- |
| 1 Create work order | `work-order-create.spec.ts` WO-CREATE-001..003 and WO-CREATE-008..010 | yes | GET only | no | no | save-gaps 1 |
| 2 Assign technician | `work-order-lifecycle.spec.ts` E2E-WO-LC-005; `uat-roles.spec.ts` daily jobs | yes | no | no | no | save-gaps 2 |
| 3 Start, hold, resume | `uat-roles.spec.ts` daily jobs; E2E-WO-LC-007 starts only | yes | no | no | no | save-gaps 3 |
| 4 Before and after photos | `uat-roles.spec.ts` upload then complete; E2E-WO-LC-011 waives photos | partial | no | no | no | save-gaps 4 |
| 5 Verify and close | E2E-WO-LC-014/015 stop at VERIFIED; uat-roles supervisor verify | partial | GET | no | no | save-gaps 5 |
| 6 Cancel with reason | `maintenance-flow.integration.spec.ts` cancels with a reason | yes | no | service row | no | save-gaps 6 |
| 7 Approvals | `work-orders-approval.spec.ts` uses mocked Prisma; block-d only opens the inbox | no | no | no | no | save-gaps 7 |
| 8 Part request and issue | E2E-INV-003/004 and E2E-WO-LC-010 assert ERP quantity is unchanged | partial | no | no | issue replay | save-gaps 8 |
| 9 Meter reading | block-d opens the page; `meter-reading-rules.spec.ts` is calculation only | no | no | no | no | save-gaps 9 |
| 10 Vendor quote tax 18 LKR | block-d checks the config field 18; uat-roles creates a purchase order | no | no | no | no | save-gaps 10 |
| 11 Asset and tag file | uat-roles `register asset` POST only | partial | no | no | no | save-gaps 11 |
| 12 User and role | block-d and uat-roles open `/admin/users` | no | no | no | no | save-gaps 12 |

`release-candidate.spec.ts` does not save these records.

## Twelve rows

| # | Flow | Result |
| --- | --- | --- |
| 1 | MANAGER creates a work order | FAIL |
| 2 | MANAGER assigns a technician | PASS |
| 3 | TECHNICIAN start, hold, resume | PASS |
| 4 | TECHNICIAN completes with before and after photos | FAIL |
| 5 | MANAGER verifies and closes | FAIL |
| 6 | MANAGER cancels with a reason | FAIL |
| 7 | ADMIN approves one item and rejects another | FAIL |
| 8 | TECHNICIAN requests a part and INVENTORY_KEEPER issues it | FAIL |
| 9 | TECHNICIAN saves a higher meter reading | PASS |
| 10 | MANAGER saves a vendor quote at tax 18 LKR | FAIL |
| 11 | ADMIN creates an asset and applies a tag file | PASS |
| 12 | ADMIN creates a user and assigns a role | PASS |

## Failures (not fixed; main stays at v1.0.0-golive)

1. Second submit of the same work-order title inserts a second row. Repro: manager `POST /api/backend/work-orders` twice with the same title. First reload shows the title and `WorkOrder` count is 1; the second POST makes the count 2. `apps/api/src/modules/work-orders/work-orders.service.ts:1110` (`createWithNumberRetry`) inserts the title with no uniqueness check.

4 and 5. Before and after photos can be stored and confirmed, then `POST .../complete-technician` returns 400 `QR verification required before completion.` Repro: plan, assign, start, upload and confirm `BEFORE_PHOTO` and `AFTER_PHOTO`, then complete. The running API is `NODE_ENV=development` and does not set `E2E_TEST_MODE`, so the bypass does not apply. `apps/api/src/common/utils/work-order-evidence-governance.ts:126`. Close was not reached.

6. Cancel persists. Repro: `PATCH /api/backend/work-orders/:id/status` with `status=CANCELLED` and `cancelReason`. SQL `WorkOrder.cancelledReason` has the reason (`work-orders.service.ts:2395`). After reload of `/maintenance/jobs?wo=:id&tab=audit` the reason text is not on the page. `cancelledReason` is only declared in `apps/web/components/work-orders/types.ts:82`. The audit panel prints `entry.reason` at `work-order-audit-panel.tsx:167`, and that string was not visible.

7. A work order submitted for approval stays `approvalStatus=PENDING` and does not appear in `GET /api/backend/approvals/inbox`. Repro: create with `requiresApproval: true`, `POST .../submit-for-approval`, then read the inbox. `work-orders.service.ts:1821` only updates the work order. The inbox is built from `ApprovalRequest` rows in `approval-inbox.service.ts:391`.

8. Part request save, reload, and a second request stay at one `PartRequest`. Issue does not reduce on-hand. Repro: technician `POST .../part-requests`, manager operational approve, inventory keeper `POST .../issue`. Response 400: `Verified ERP stock is unavailable. Missing ERP provenance...` at `apps/api/src/modules/inventory/verified-stock-availability.ts:10`. `SparePart.quantityInStock` is documented as unchanged by a work-order issue at `prisma/schema.prisma:1892`.

10. The quote reopens on the Vendor Repair tab showing `18%`, and the first SQL count is 1. A second `POST .../vendor-repair/quotations` with the same quotation number inserts a second row. `apps/api/src/modules/work-orders/vendor-repair.service.ts:200`.

## Mapped tests run with this session

- `playwright.full-stack.config.ts` on nginx `127.0.0.1:18080`, database `maintainpro_e2e_primary`: block-d tax, approvals, meter page, and admin users passed on desktop and mobile. `uat-roles.spec.ts` `daily jobs and denied actions` passed. `WO-CREATE-001..003` and `WO-CREATE-008..010` passed. Full `work-order-lifecycle.spec.ts`: 25 passed, including E2E-WO-LC-005, LC-007, LC-011, LC-014, and LC-015. A grep that skipped the earlier lifecycle steps made LC-005 return 404; that run is not the result.
- API `maintenance-flow.integration.spec.ts` on `maintainpro_e2e_wo_verify`: `runs plan, assign, hold, resume, evidence gate, verify, and close` passed, and `cancels with a reason and emergency-closes with an audit reason` passed (2 passed, 9.9s).
