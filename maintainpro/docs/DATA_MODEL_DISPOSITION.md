# Data Model Disposition (Phase 0)

**Baseline:** `origin/main` @ `290bf3a`  
**Rule:** Do **not** drop models in Phase 0. Phase 14 (or later) only after migration + backup proof.

Totals: **~137 models**, **~148 enums**.

---

## Classification summary

| Class | Approx | Meaning |
|-------|--------|---------|
| KEEP | ~85–90 | Core CMMS / fleet / inventory / auth |
| REFACTOR | ~20–25 | Keep concept; fix structure |
| MIGRATE | ~25–30 | Move out of core product or consolidate |
| REMOVE | ~1–2 near-term | Mock-only / foldable after confirmation |

---

## KEEP (core — retain)

**Platform:** Tenant, AuditLog, SecurityEvent, OperationalAlert, AppSetting, ReplicationOutbox, Permission, Role, DomainEventOutbox, BusinessException, BudgetCommitment  

**Identity:** User (structure), RefreshToken, PasswordResetToken, TenantMembership, Department, Employee, WorkOrderAssignee, EmployeeRosterEntry, EmployeeLeaveRequest, Driver  

**Assets/Fleet ops:** FuelLog, TripLog, VehicleMeterLog, VehicleGateMovement, VehicleDocument, AccidentReport, AccidentEvidence, InsuranceClaim, TrafficFine, InstalledPart  

**Maintenance/WO:** WorkOrder, WorkOrderTaxonomy, WorkOrderPart, EvidenceAttachment, JobCode, MaintenanceForecast  

**Inventory/Procurement:** Warehouse, WarehouseItemBalance, StockMovement, InventoryIdempotency, BulkImportRun/Row, Supplier, PurchaseOrder*, PartRequest*, PartIssue, PurchaseReceipt*, VendorRepairCase/Quotation/Invoice, PartCompatibility, ProcurementRecommendation, ErpFieldMapping, ErpImportBatch/Row, ErpReconciliationMismatch  

**Facility spine:** Property, Building, Floor, Room  

**Utilities/Notifications:** UtilityMeter, MeterReading, UtilityBill, Notification  

**Support (ops):** SupportTicket, EscalationRule  

---

## REFACTOR (must redesign)

| Model | Reason | Target |
|-------|--------|--------|
| Asset | Overlaps Vehicle; free-text location; farm categories mixed in | Equipment spine + typed profiles |
| Vehicle | Soft assetTag only; duplicates lifecycle fields | FK/subtype of Asset |
| MaintenanceSchedule | Dual asset/vehicle; **no tenantId** | Single subject + required tenant |
| MaintenanceLog | Dual subject | Align with schedule subject |
| User | Auth mixed with labor skills/capacity | Identity only; labor on Employee |
| TenantInvitation / UserInvitation | Parallel invite flows | Unify |
| SparePart | Denormalized stock vs warehouse balances | Balances authoritative; SparePart = catalog |
| InventoryStockIssueIdempotency | Narrow duplicate | Fold into InventoryIdempotency |
| CleaningLocation | Parallel string location | FK to Room/Property |
| FacilityIssue | Dual location pointers | Prefer Room |
| GpsLocation | High volume in Mongo | External telematics / TS store later |
| VehicleHealthSnapshot / PredictiveLog | Advisory scoring | Align with forecasts; AI not final gate |
| Copilot* | Assistance; PII/retention | Optional / policy-gated |

---

## MIGRATE (out of core product surface)

### Farm operations (infrastructure assets stay via Asset)
Field, CropCycle, HarvestRecord, LivestockAnimal, AnimalHealthRecord, AnimalProductionLog, FeedingLog, IrrigationLog, SprayLog, SoilTest, WeatherLog, FarmWorker, AttendanceLog, FarmExpense, FarmIncome, TraceabilityRecord  

### Delivery / QA / go-live tooling
QaIssue, QaIssueRca, QaRegressionTest, DeliveryChecklist*, DeliverySignOff, ChangeRequest, SoftwareRelease, HypercarePlan, SupportHandover, PilotRollout, CutoverChecklistItem, RolloutWave, GoLiveDecision, RollbackPlan, GoLiveSignOff, UatScenarioExecution, ErpAccessChecklistItem  

### Duplicate ERP Excel path
InventoryImportRun, InventoryImportRow → absorb into ErpImport*

### SaaS billing (retain code if multi-tenant deploy needs it; hide UX for Nelna single-org)
Plan, Subscription, Entitlement, UsageMetric, UsageEvent, StripeCustomer, StripeInvoice — **MIGRATE UX**; schema KEEP until decoupled  

TrainingSession — REFACTOR/KEEP if product training needed; else MIGRATE with delivery tooling  

---

## REMOVE (only after confirmation)

| Model | Reason | Blocker |
|-------|--------|---------|
| ErpMockSyncRun | Dev/mock artifact | Confirm no prod dependency; then drop |
| InventoryStockIssueIdempotency | After fold into InventoryIdempotency | Migration of keys |

---

## Duplicated concepts

| Concept | Current | Disposition |
|---------|---------|-------------|
| Asset vs Vehicle | Parallel masters | REFACTOR — Vehicle is Asset profile |
| Locations | 5+ concepts | REFACTOR — Property hierarchy canonical |
| People | User/Employee/Driver/FarmWorker | REFACTOR + MIGRATE FarmWorker |
| Stock import | Two stacks | MIGRATE InventoryImport* |
| PM vs schedules | MaintenanceSchedule only on main | Later phases add PmPlan (feature branches) — not on main yet |
| Checklists | Cleaning + delivery checklists | Need generic PM checklist (MISSING on main) |

---

## Cleanup safety map (future)

| Bucket | Examples | When removable |
|--------|----------|----------------|
| Safe to retain | Core KEEP set | Always |
| Needs migration | Farm, go-live tooling | After export + UI retired |
| Dependency blockers | Tenant FKs, WO relations | After runtime removal |
| Historical records | GoLiveDecision, AuditLog | Export before drop |
| Appears dead | ErpMockSyncRun | Confirm + Phase 14 |
| Remove after runtime removal | Farm/Cleaning UI first | Phase 1 hide → later drop |
| Migration order | 1) UI/API hide 2) stop writes 3) export 4) drop | Prefer Phase 14 |

**Farm infrastructure maintenance** remains via Asset categories (TRACTOR, IRRIGATION_*, etc.) even if Farm Operations models migrate out.

---

## Enums note

`RoleName` (29 values) and farm/cleaning/go-live enums inflate surface area. Prefer permission packs; deprecate unused RoleNames in later RBAC phase — do not delete enum values without alias migration.
