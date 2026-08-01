# Work Order Lifecycle Contract (Phase 5B)

**Document type:** E2E + API contract for the full work-order execution lifecycle.

**Success statuses:** Exact HTTP codes only — no `status < 500` assertions in E2E.

## Option A decisions (backend)

| Decision | Implementation |
| --- | --- |
| Maker-checker approval | Creator cannot `PATCH /work-orders/:id/approve` their own pending WO (403). Admin/manager override requires `emergencyOverrideReason`. |
| `createdById` | Always resolved from authenticated actor (`/auth/me`), not client-supplied fixtures. |
| Assignees | `POST /work-orders/:id/assign` sets legacy `technicianId` and syncs canonical `WorkOrderAssignee` rows. |
| Assignment before start | `PATCH /work-orders/:id/status` → `IN_PROGRESS` returns **400** when no assignee/technician. |
| Approval before execution | Start/complete paths call `assertWorkOrderApprovedForExecution` (**400** when `approvalStatus=PENDING`). |
| Technician completion | Tech sending `COMPLETED` is remapped to `TECHNICIAN_COMPLETED` with mandatory `completionNote`, `actualCost`, `actualHours`. |
| Evidence when storage off | `STORAGE_UPLOADS_ENABLED` false waives before/after photo requirements; completion note remains mandatory. |
| Hold | `ON_HOLD` requires `delayReason` (hold reason). |
| Supervisor close | `POST /work-orders/:id/verify-supervisor` transitions `TECHNICIAN_COMPLETED` → **COMPLETED** (HTTP **200**). |

## Primary lifecycle (E2E-WO-LC-001..020)

1. **Create** — `POST /work-orders` with `requiresApproval:true`, type `CORRECTIVE`, priority `MEDIUM`, no asset. **201**
2. **Read** — status `OPEN`, `approvalStatus` `PENDING`. **200**
3. **Submit** — `POST /work-orders/:id/submit-for-approval`. **200**
4. **Approve** — manager self-approve **403**; admin-a approve **200** → `APPROVED`
5. **Assign** — `POST /work-orders/:id/assign` with `technicianId` from tech-a `/auth/me`. **200**
6. **Plan** — `PATCH /work-orders/:id` `plannedStartAt`/`plannedEndAt`/`estimatedHours`. **200**
7. **Start** — tech-a `PATCH` status `IN_PROGRESS`. **200**
8. **Notes** — `POST /work-orders/:id/notes`. **200**
9. **Stock issue** — inventory-a stock-out with `workOrderId` + `idempotencyKey`. **200**
10. **Idempotency** — replay same key does not double-deduct.
11. **Evidence** — `TECHNICIAN_NOTE` metadata **201**; photos waived when storage disabled.
12. **Tech complete** — `PATCH` status with note/cost/hours → `TECHNICIAN_COMPLETED`. **200**
13. **Supervisor verify** — admin-a `POST verify-supervisor`. **200** → `COMPLETED`
14. **Persist** — GET shows `actualCost` / `actualHours`.
15. **Audit** — GET `/activity` and `/history` **200**; list contains completed WO by title.

## Negative contract highlights

| Case | Expected |
| --- | --- |
| Start before approval | **400** |
| Start without assignee | **400** |
| Tech verify-supervisor | **403** |
| Cross-tenant GET | **403** or **404** |
| Status PATCH without CSRF | **403** `CSRF_INVALID` |

## E2E constraints

- Serial suite tagged `@full-stack @security @erp-control`
- No `test.skip`, no hardcoded Mongo ObjectIds, no direct DB access
- Distinct `BrowserContext` / actor logins per step where required
- Diagnostic gate: `@wo-lifecycle-gate` only

## Validation scripts

- `npm run validate:e2e-work-order-lifecycle`
- `npm run test:work-order-lifecycle-contract`
