# WorkOrder normalization — future destructive cleanup manifest (DB-7+)

**Status:** REPORT ONLY — DO NOT DROP  
**Branch context:** `maintainpro/db-normalization-safe-chain`  
**As of:** after DB-2…DB-7 safe chain (physical columns still present)

## WorkOrder legacy columns → canonical extension

| LEGACY COLUMN | CANONICAL NEW LOCATION | READERS REMAINING | WRITERS REMAINING | BACKFILL | RECONCILE | SAFE_TO_DROP? | RISK |
|---------------|------------------------|-------------------|-------------------|----------|-----------|---------------|------|
| expectedCompletionDate, plannedStartAt, plannedEndAt, delayReason, cancelledReason, estimatedHours, estimatedDurationMinutes, slaDeadline, slaBreached | WorkOrderPlanning | Compat overlay + some list indexes (dueDate stays on base) | Dual-write mirror | Tooling exists | Required 0 mismatches | NO | MED — list may still filter plannedEndAt |
| executionMode, vendorSupplierId, approved*, startDate, failedAt…resumedAt, hold*, correctionReason | WorkOrderExecution | Compat overlay | Dual-write | Tooling | Required | NO | MED — hold current state vs HoldHistory |
| completedDate, verification*, reopen*, actualHours, completion*, followUp*, qr*, requester*, functional/road/meter/restriction/impact | WorkOrderCompletion | Compat overlay | Dual-write | Tooling | Required | NO | HIGH — lifecycle critical |
| riskLevel, ppeRequired, loto*, hotWork*, workingAtHeight, electricalIsolation, confinedSpace, permitReference | WorkOrderSafety | Compat overlay | Dual-write | Tooling | Required | NO | LOW |
| maintenanceTemplate*, failure/cause/remedy*, taxonomy*, *Snapshot, isTriage, triage* | WorkOrderClassification | Compat overlay | Dual-write | Tooling | Required | NO | MED — snapshots must remain |
| attachments (JSON) | EvidenceAttachment | Legacy readers | Legacy writers | N/A | N/A | NO | HIGH — migrate evidence first |
| downtimeStartedAt/EndedAt/Reason | DowntimeSegment | Legacy | Legacy | N/A | N/A | NO | MED |
| temporaryRepair* | TemporaryRepairRecord | Legacy | Legacy | N/A | N/A | NO | MED |

`SAFE_TO_DROP = YES` requires: 100% reconcile, no business readers/writers except isolated compat, backup, fresh+upgrade DB proof, CI green, **explicit operator signoff**. Even then: **do not drop in this chain**.

## Deferred (not in this master run)

| Area | Future action |
|------|---------------|
| Asset free-text category/location/department/meter/service/warranty/images | DEPRECATE_LATER toward masters/meters/EntityWarranty/Evidence |
| Vehicle assetTag/description/location/purchase/warranty/images/service dates | MOVE_TO_ASSET / DERIVE / DEPRECATE_LATER |
| SparePart quantityInStock/reserved/available/location | KEEP as cache until WarehouseItemBalance proven |
| MaintenanceSchedule / MaintenanceLog | DROP_LATER after Pm* cutover |
| Farm / Cleaning / QA / Delivery / GoLive / Billing UX / Support / Copilot / ErpMock / GpsLocation / FacilityIssue / InventoryImport* | Per disposition: MIGRATE_OUT / ARCHIVE / DROP_LATER |

## WorkOrder base target (logical, ~28–32)

Keep on base for identity / filters / OCC:

id, tenantId, woNumber, title, description, priority, status, approvalStatus, type, assetId, vehicleId, scheduleId (until PM legacy gone), createdById, technicianId, dueDate, estimatedCost, actualCost, notes, accidentId, trafficFineId, siteId, functionalLocationId, departmentId, domainId, jobDomain, underWarranty, closedAt, affectsOperation, downtimeApplicable, repeatFailureCandidate, workflowVersionId, lastIdempotencyKey, version, createdAt, updatedAt, pmPlanId, pmPlanRevision, pmTriggerSource, pmOccurrenceKey, **jobCategoryId**
