# Database ↔ Repository Map

One page that ties the SQL Server database design to the code that uses it. Read this before adding, changing, or dropping a table.

**Generated:** 2026-09-30 from `prisma/schema.prisma` and a scan of `apps/api/src`, `apps/api/test`, `apps/web`, `scripts`, and `prisma/`.  
**Branch:** `feature/phase-07-my-jobs` @ `a132663b`.  
**Live database:** not inspected by this pass. See [Section 5](#5-compare-the-live-database-with-this-map) to check it.

## 1. Source of truth

| Layer | Location | Notes |
| --- | --- | --- |
| Schema | `prisma/schema.prisma` | `provider = "sqlserver"`, one schema for the whole API, 222 models, 0 enums (statuses are strings). |
| Migrations | `prisma/migrations/` (25 folders, `20260915120000` → `20260929120000`) | The only rollout path. Apply with `npm run db:migrate:deploy`. Never `db push` against staging or production. |
| Legacy | `prisma/migrations_legacy_postgresql/`, `infra/mongo/`, MongoDB text in older docs | Historical. Not applied. |
| Views | `vw_rpt_dim_branch_site`, `vw_rpt_dim_date`, `vw_rpt_fact_downtime`, `vw_rpt_fact_maintenance` | Created in `20260917230000_reporting_views`, hardened in `20260917240000`. Power BI reads these and must filter by `tenantId`. |
| Triggers | `trg_Asset_no_hierarchy_cycle`, `trg_AuditLog_immutable`, `trg_ConfigChangeHistory_immutable`, `trg_MaintenanceRequest_tenant_asset`, `trg_MeterCorrection_tenant_meter`, `trg_OrganizationUnit_tenant_parent`, `trg_PartRequest_tenant_wo`, `trg_VendorPortalAccess_tenant`, `trg_WorkOrder_tenant_refs` | Tenant integrity and append-only audit. Created in `20260917240000_database_integrity_hardening`. |
| Stored procedures / functions | none | |
| Foreign keys | all `ON DELETE NO ACTION` | No cascades. Deletes must clear children first. |

A table that exists in the live database but not in `schema.prisma` is not part of this product. Prisma cannot read or write it.

## 2. Summary

| Status | Models | Meaning | What to do |
| --- | ---: | --- | --- |
| **CORE** | 164 | In product scope (CMMS, fleet, spare parts, vendors, ERP, reports, admin) and used by API code. | Keep. Secure with tenant scoping and RBAC. |
| **RETIRED** | 53 | Domain removed from the product surface in Phase 01 (`docs/PHASE_01_SCOPE_CLEANUP.md`), but API modules still read and write it. | Keep for now. Dropping needs the module removed first, data exported, and business sign-off (`docs/DATA_DISPOSITION_REPORT.md`). |
| **UNUSED** | 5 | In the schema, but no API, web, test, script, or view reads or writes it. | Candidate for removal through a migration, after checking the live row count is 0. |
| **Total** | 222 | | |

"Used" means a Prisma call (`prisma.x.findMany`, `tx.x.create`, …) or a nested relation write/include from a parent model. The count column is the number of API source files with a direct call.

## 3. Core tables by domain

### Platform, tenancy and audit (10)

| Model | SQL table | API files | Used by |
| --- | --- | ---: | --- |
| Tenant | `Tenant` | 14 | admin, admin-governance, farm |
| AuditLog | `AuditLog` | 28 | approvals, assets, audit |
| SecurityEvent | `SecurityEvent` | 1 | audit |
| OperationalAlert | `OperationalAlert` | 1 | operations |
| AppSetting | `AppSetting` | 6 | enterprise-ops, notifications, settings |
| ReplicationOutbox | `ReplicationOutbox` | 3 | database |
| DomainEventOutbox | `DomainEventOutbox` | 1 | enterprise-ops |
| NumberingSequence | `NumberingSequence` | 1 | numbering |
| Notification | `Notification` | 5 | cleaning, notifications, queues |
| BusinessException | `BusinessException` | 4 | admin-governance, enterprise-ops |

### Identity and RBAC (12)

| Model | SQL table | API files | Used by |
| --- | --- | ---: | --- |
| User | `User` | 35 | accidents, admin-governance, approvals |
| RefreshToken | `RefreshToken` | 2 | auth, users |
| PasswordResetToken | `PasswordResetToken` | 1 | auth |
| Role | `Role` | 8 | admin, auth, people |
| Permission | `Permission` | 3 | admin, roles |
| RolePermission | `RolePermission` | 3 | admin, roles |
| TenantMembership | `TenantMembership` | 8 | auth, invitations, people |
| TenantInvitation | `TenantInvitation` | 3 | admin, auth, invitations |
| UserInvitation | `UserInvitation` | 3 | auth, people |
| UserSkill | `UserSkill` | 2 | common |
| SoDPolicy | `SoDPolicy` | 1 | enterprise-governance |
| ServiceApiKey | `ServiceApiKey` | 1 | enterprise-governance |

### Organization and locations (8)

| Model | SQL table | API files | Used by |
| --- | --- | ---: | --- |
| Department | `Department` | 12 | assets, bulk-import, departments |
| Site | `Site` | 5 | assets, maintenance-requests, organization |
| FunctionalLocation | `FunctionalLocation` | 5 | assets, organization, planning |
| Property | `Property` | 2 | facilities, organization |
| Building | `Building` | 1 | facilities |
| Floor | `Floor` | 1 | facilities |
| Room | `Room` | 4 | cleaning, facilities |
| OrganizationUnit | `OrganizationUnit` | 0 | no API code; read by the Power BI view `vw_rpt_dim_branch_site` |

### People and workforce (2)

| Model | SQL table | API files | Used by |
| --- | --- | ---: | --- |
| Employee | `Employee` | 8 | enterprise-ops, people, work-orders |
| EmployeeLeaveRequest | `EmployeeLeaveRequest` | 1 | workforce |

### Assets (11)

| Model | SQL table | API files | Used by |
| --- | --- | ---: | --- |
| Asset | `Asset` | 23 | admin-governance, approvals, asset-taxonomy |
| AssetDomain | `AssetDomain` | 4 | asset-taxonomy, assets, maintenance-requests |
| AssetCategoryMaster | `AssetCategoryMaster` | 3 | asset-taxonomy, assets, scripts |
| AssetTypeMaster | `AssetTypeMaster` | 3 | asset-taxonomy, assets, scripts |
| AssetAttributeDefinition | `AssetAttributeDefinition` | 2 | asset-taxonomy, assets |
| AssetLocationHistory | `AssetLocationHistory` | 1 | assets |
| AssetMeter | `AssetMeter` | 4 | enterprise-governance, fleet-lifecycle, planning |
| AssetMeterReading | `AssetMeterReading` | 3 | enterprise-governance, planning, work-orders |
| MeterCorrection | `MeterCorrection` | 1 | enterprise-governance |
| EntityWarranty | `EntityWarranty` | 1 | warranties |
| WarrantyClaim | `WarrantyClaim` | 1 | warranties |

### Maintenance requests (4)

| Model | SQL table | API files | Used by |
| --- | --- | ---: | --- |
| MaintenanceRequest | `MaintenanceRequest` | 2 | maintenance-config, maintenance-requests |
| MaintenanceRequestHistory | `MaintenanceRequestHistory` | 1 | maintenance-requests |
| RequestProblemCategory | `RequestProblemCategory` | 1 | maintenance-requests |
| EvidenceAttachment | `EvidenceAttachment` | 5 | evidence, maintenance-requests, planning |

### Work orders (15)

| Model | SQL table | API files | Used by |
| --- | --- | ---: | --- |
| WorkOrder | `WorkOrder` | 50 | accidents, admin-governance, approvals |
| WorkOrderAssignee | `WorkOrderAssignee` | 6 | reports, work-orders, workforce |
| WorkOrderStatusHistory | `WorkOrderStatusHistory` | 1 | work-orders |
| WorkOrderHoldHistory | `WorkOrderHoldHistory` | 1 | work-orders |
| WorkOrderLabourEntry | `WorkOrderLabourEntry` | 2 | maintenance-supply, work-orders |
| WorkOrderPart | `WorkOrderPart` | 7 | enterprise-ops, reports, work-orders |
| WorkOrderTaxonomy | `WorkOrderTaxonomy` | 1 | work-order-taxonomy |
| WorkOrderPlanning | `WorkOrderPlanning` | 2 | work-orders |
| WorkOrderExecution | `WorkOrderExecution` | 1 | work-orders |
| WorkOrderCompletion | `WorkOrderCompletion` | 1 | work-orders |
| WorkOrderSafety | `WorkOrderSafety` | 1 | work-orders |
| WorkOrderClassification | `WorkOrderClassification` | 1 | work-orders |
| WorkOrderCostSnapshot | `WorkOrderCostSnapshot` | 2 | maintenance-supply, work-orders |
| TemporaryRepairRecord | `TemporaryRepairRecord` | 1 | enterprise-governance |
| MaintenanceLog | `MaintenanceLog` | 6 | assets, driver-intelligence, maintenance |

### Maintenance configuration (12)

| Model | SQL table | API files | Used by |
| --- | --- | ---: | --- |
| JobCode | `JobCode` | 2 | bulk-import, job-codes |
| JobCodeRequiredPart | `JobCodeRequiredPart` | 1 | job-codes |
| MaintenanceJobCategory | `MaintenanceJobCategory` | 3 | maintenance-config, maintenance-requests, work-orders |
| MaintenanceAnalysisCode | `MaintenanceAnalysisCode` | 1 | maintenance-config |
| MaintenanceReasonCode | `MaintenanceReasonCode` | 1 | maintenance-config |
| PrioritySlaRule | `PrioritySlaRule` | 1 | maintenance-config |
| MaintenanceTemplate | `MaintenanceTemplate` | 1 | maintenance-config |
| TenantFeatureFlag | `TenantFeatureFlag` | 1 | maintenance-config |
| ConfigChangeHistory | `ConfigChangeHistory` | 8 | enterprise-governance, maintenance-config, planning |
| CustomFieldDefinition | `CustomFieldDefinition` | 1 | enterprise-governance |
| WorkflowDefinition | `WorkflowDefinition` | 1 | workflow-engine |
| WorkflowVersion | `WorkflowVersion` | 1 | workflow-engine |

### Preventive maintenance and inspections (16)

| Model | SQL table | API files | Used by |
| --- | --- | ---: | --- |
| PmPlan | `PmPlan` | 3 | maintenance-config, planning, work-orders |
| PmPlanRevision | `PmPlanRevision` | 1 | planning |
| PmTrigger | `PmTrigger` | 0 | nested via PmPlan.triggers |
| PmPlanRequiredPart | `PmPlanRequiredPart` | 0 | nested via PmPlan.requiredParts |
| PmOccurrence | `PmOccurrence` | 2 | planning, work-orders |
| PmAutoGeneration | `PmAutoGeneration` | 1 | planning |
| MaintenanceSchedule | `MaintenanceSchedule` | 5 | enterprise-ops, maintenance, predictive-ai |
| MaintenanceForecast | `MaintenanceForecast` | 1 | enterprise-ops |
| ChecklistTemplate | `ChecklistTemplate` | 2 | maintenance-config, planning |
| ChecklistTemplateItem | `ChecklistTemplateItem` | 0 | nested via ChecklistTemplate.items |
| ChecklistExecution | `ChecklistExecution` | 1 | planning |
| InspectionTemplate | `InspectionTemplate` | 1 | planning |
| Inspection | `Inspection` | 1 | planning |
| InspectionFinding | `InspectionFinding` | 1 | planning |
| CalibrationRecord | `CalibrationRecord` | 1 | planning |
| ComplianceRequirement | `ComplianceRequirement` | 2 | maintenance-supply, planning |

### Reliability and safety (8)

| Model | SQL table | API files | Used by |
| --- | --- | ---: | --- |
| DowntimeSegment | `DowntimeSegment` | 2 | reliability, workflow-engine |
| RcaCase | `RcaCase` | 1 | reliability |
| CapaAction | `CapaAction` | 1 | reliability |
| WorkPermit | `WorkPermit` | 1 | reliability |
| LotoRecord | `LotoRecord` | 1 | reliability |
| ReliabilityPolicy | `ReliabilityPolicy` | 1 | reliability |
| ConditionMonitoringRule | `ConditionMonitoringRule` | 1 | reliability |
| ConditionEvent | `ConditionEvent` | 1 | reliability |

### Approvals (6)

| Model | SQL table | API files | Used by |
| --- | --- | ---: | --- |
| ApprovalRule | `ApprovalRule` | 1 | approvals |
| ApprovalRuleLevel | `ApprovalRuleLevel` | 0 | nested via ApprovalRule.levels |
| ApprovalRequest | `ApprovalRequest` | 3 | admin-governance, approvals, maintenance-config |
| ApprovalStep | `ApprovalStep` | 1 | approvals |
| ApprovalDecision | `ApprovalDecision` | 2 | approvals, vehicles |
| ApprovalDelegation | `ApprovalDelegation` | 1 | enterprise-governance |

### Fleet (16)

| Model | SQL table | API files | Used by |
| --- | --- | ---: | --- |
| Vehicle | `Vehicle` | 30 | accidents, admin-governance, assets |
| VehicleTyre | `VehicleTyre` | 1 | fleet-lifecycle |
| VehicleBattery | `VehicleBattery` | 1 | fleet-lifecycle |
| VehicleAssignment | `VehicleAssignment` | 1 | fleet-lifecycle |
| VehicleMeterLog | `VehicleMeterLog` | 4 | enterprise-ops, vehicles, work-orders |
| VehicleGateMovement | `VehicleGateMovement` | 1 | vehicles |
| VehicleDocument | `VehicleDocument` | 3 | compliance, vehicle-documents, work-orders |
| VehicleHealthSnapshot | `VehicleHealthSnapshot` | 1 | enterprise-ops |
| GpsLocation | `GpsLocation` | 2 | fleet, vehicles |
| Driver | `Driver` | 10 | accidents, driver-intelligence, drivers |
| FuelLog | `FuelLog` | 6 | driver-intelligence, enterprise-ops, fuel |
| TripLog | `TripLog` | 4 | driver-intelligence, enterprise-ops, trips |
| AccidentReport | `AccidentReport` | 5 | accidents, driver-intelligence, enterprise-ops |
| AccidentEvidence | `AccidentEvidence` | 1 | accidents |
| InsuranceClaim | `InsuranceClaim` | 4 | driver-intelligence, enterprise-ops, fleet-lifecycle |
| TrafficFine | `TrafficFine` | 3 | driver-intelligence, enterprise-ops, traffic-fines |

### Spare parts and inventory (15)

| Model | SQL table | API files | Used by |
| --- | --- | ---: | --- |
| SparePart | `SparePart` | 18 | admin-governance, enterprise-ops, erp-integration |
| Warehouse | `Warehouse` | 5 | inventory, maintenance-supply |
| WarehouseItemBalance | `WarehouseItemBalance` | 5 | enterprise-ops, erp-integration, inventory |
| StockMovement | `StockMovement` | 6 | inventory, predictive-ai, reports |
| StockCountSession | `StockCountSession` | 1 | inventory |
| StockCountLine | `StockCountLine` | 1 | inventory |
| InventoryIdempotency | `InventoryIdempotency` | 1 | inventory |
| InventoryStockIssueIdempotency | `InventoryStockIssueIdempotency` | 1 | inventory |
| InventoryImportRun | `InventoryImportRun` | 1 | inventory |
| InventoryImportRow | `InventoryImportRow` | 1 | inventory |
| PartRequest | `PartRequest` | 3 | inventory, work-orders |
| PartRequestApproval | `PartRequestApproval` | 1 | work-orders |
| PartIssue | `PartIssue` | 2 | maintenance-supply, work-orders |
| PartCompatibility | `PartCompatibility` | 1 | enterprise-ops |
| InstalledPart | `InstalledPart` | 1 | enterprise-ops |

### Procurement (9)

| Model | SQL table | API files | Used by |
| --- | --- | ---: | --- |
| PurchaseOrder | `PurchaseOrder` | 8 | enterprise-ops, inventory, reports |
| PurchaseOrderLine | `PurchaseOrderLine` | 3 | inventory |
| PurchaseOrderApproval | `PurchaseOrderApproval` | 4 | inventory |
| PurchaseOrderErpSync | `PurchaseOrderErpSync` | 5 | erp-integration, inventory, reports |
| PurchaseReceipt | `PurchaseReceipt` | 1 | inventory |
| PurchaseReceiptLine | `PurchaseReceiptLine` | 1 | inventory |
| PurchaseReceiptIdempotency | `PurchaseReceiptIdempotency` | 1 | inventory |
| ProcurementRecommendation | `ProcurementRecommendation` | 2 | enterprise-ops |
| BudgetCommitment | `BudgetCommitment` | 1 | enterprise-ops |

### Vendors (8)

| Model | SQL table | API files | Used by |
| --- | --- | ---: | --- |
| Supplier | `Supplier` | 11 | bulk-import, enterprise-governance, enterprise-ops |
| VendorContract | `VendorContract` | 3 | maintenance-supply, work-orders |
| VendorContractAsset | `VendorContractAsset` | 0 | nested via VendorContract.contractAssets |
| VendorContractSite | `VendorContractSite` | 0 | nested via VendorContract.contractSites |
| VendorRepairCase | `VendorRepairCase` | 3 | reports, vendor-portal, work-orders |
| VendorQuotation | `VendorQuotation` | 3 | reports, vendor-portal, work-orders |
| VendorInvoice | `VendorInvoice` | 5 | enterprise-ops, maintenance-supply, reports |
| VendorPortalAccess | `VendorPortalAccess` | 1 | vendor-portal |

### ERP sync (Bileeta) (5)

| Model | SQL table | API files | Used by |
| --- | --- | ---: | --- |
| ErpFieldMapping | `ErpFieldMapping` | 1 | erp-integration |
| ErpImportBatch | `ErpImportBatch` | 4 | erp-integration, inventory |
| ErpImportRow | `ErpImportRow` | 2 | erp-integration, inventory |
| ErpReconciliationMismatch | `ErpReconciliationMismatch` | 5 | enterprise-ops, erp-integration |
| ErpAccessChecklistItem | `ErpAccessChecklistItem` | 1 | erp-integration |

### Bulk import and integrations (4)

| Model | SQL table | API files | Used by |
| --- | --- | ---: | --- |
| BulkImportRun | `BulkImportRun` | 2 | admin-governance, bulk-import |
| BulkImportRow | `BulkImportRow` | 1 | bulk-import |
| OutboundWebhook | `OutboundWebhook` | 1 | enterprise-governance |
| OutboundWebhookDelivery | `OutboundWebhookDelivery` | 1 | enterprise-governance |

### Utilities (3)

| Model | SQL table | API files | Used by |
| --- | --- | ---: | --- |
| UtilityMeter | `UtilityMeter` | 3 | notifications, utilities |
| MeterReading | `MeterReading` | 3 | asset-taxonomy, utilities |
| UtilityBill | `UtilityBill` | 5 | notifications, predictive-ai, reports |

## 4. Retired and unused tables

### 4.1 Retired domains (still wired to API code)

Hidden from navigation and soft-blocked for non-admins. The backend modules are still registered in `apps/api/src/app.module.ts`, so these tables cannot be dropped until those modules are removed.

#### Facility issues (transitional) (1)

| Model | SQL table | API files | Used by |
| --- | --- | ---: | --- |
| FacilityIssue | `FacilityIssue` | 5 | cleaning, facilities, notifications |

#### ERP mock provider (1)

| Model | SQL table | API files | Used by |
| --- | --- | ---: | --- |
| ErpMockSyncRun | `ErpMockSyncRun` | 1 | erp-integration |

#### Cleaning workforce (4)

| Model | SQL table | API files | Used by |
| --- | --- | ---: | --- |
| CleaningLocation | `CleaningLocation` | 5 | cleaning, facilities |
| CleaningVisit | `CleaningVisit` | 2 | cleaning, notifications |
| CleaningChecklistTemplate | `CleaningChecklistTemplate` | 0 | nested via CleaningLocation.checklistTemplates |
| CleaningChecklist | `CleaningChecklist` | 0 | nested via CleaningVisit.checklist |

#### Farm operations (17)

| Model | SQL table | API files | Used by |
| --- | --- | ---: | --- |
| Field | `Field` | 7 | farm |
| CropCycle | `CropCycle` | 5 | farm |
| HarvestRecord | `HarvestRecord` | 2 | farm |
| LivestockAnimal | `LivestockAnimal` | 1 | farm |
| AnimalHealthRecord | `AnimalHealthRecord` | 1 | farm |
| AnimalProductionLog | `AnimalProductionLog` | 1 | farm |
| FeedingLog | `FeedingLog` | 1 | farm |
| IrrigationLog | `IrrigationLog` | 1 | farm |
| SprayLog | `SprayLog` | 2 | farm |
| SoilTest | `SoilTest` | 2 | farm |
| WeatherLog | `WeatherLog` | 1 | farm |
| FarmWorker | `FarmWorker` | 1 | farm |
| AttendanceLog | `AttendanceLog` | 1 | farm |
| FarmExpense | `FarmExpense` | 2 | farm, reports |
| FarmIncome | `FarmIncome` | 1 | farm |
| TraceabilityRecord | `TraceabilityRecord` | 1 | farm |
| TraceabilitySprayLink | `TraceabilitySprayLink` | 0 | nested via TraceabilityRecord.sprayLinks |

#### SaaS billing (7)

| Model | SQL table | API files | Used by |
| --- | --- | ---: | --- |
| Plan | `Plan` | 2 | billing |
| Subscription | `Subscription` | 3 | billing, entitlements |
| Entitlement | `Entitlement` | 1 | database |
| UsageMetric | `UsageMetric` | 1 | entitlements |
| UsageEvent | `UsageEvent` | 1 | entitlements |
| StripeCustomer | `StripeCustomer` | 1 | billing |
| StripeInvoice | `StripeInvoice` | 1 | billing |

#### Predictive AI and copilot (4)

| Model | SQL table | API files | Used by |
| --- | --- | ---: | --- |
| PredictiveLog | `PredictiveLog` | 2 | maintenance, predictive-ai |
| CopilotConversation | `CopilotConversation` | 1 | predictive-ai |
| CopilotMessage | `CopilotMessage` | 1 | predictive-ai |
| CopilotExchangeLog | `CopilotExchangeLog` | 1 | predictive-ai |

#### Project delivery, QA and go-live (19)

| Model | SQL table | API files | Used by |
| --- | --- | ---: | --- |
| QaIssue | `QaIssue` | 8 | delivery-readiness, go-live, post-go-live |
| QaIssueRca | `QaIssueRca` | 1 | qa |
| QaRegressionTest | `QaRegressionTest` | 1 | qa |
| DeliveryChecklist | `DeliveryChecklist` | 1 | delivery-readiness |
| DeliveryChecklistItem | `DeliveryChecklistItem` | 1 | delivery-readiness |
| DeliverySignOff | `DeliverySignOff` | 1 | delivery-readiness |
| TrainingSession | `TrainingSession` | 2 | go-live, post-go-live |
| SupportTicket | `SupportTicket` | 7 | go-live, post-go-live |
| EscalationRule | `EscalationRule` | 1 | post-go-live |
| ChangeRequest | `ChangeRequest` | 2 | post-go-live |
| SoftwareRelease | `SoftwareRelease` | 2 | post-go-live |
| HypercarePlan | `HypercarePlan` | 1 | post-go-live |
| SupportHandover | `SupportHandover` | 1 | post-go-live |
| PilotRollout | `PilotRollout` | 2 | go-live |
| CutoverChecklistItem | `CutoverChecklistItem` | 1 | go-live |
| RolloutWave | `RolloutWave` | 2 | go-live |
| GoLiveDecision | `GoLiveDecision` | 2 | go-live |
| RollbackPlan | `RollbackPlan` | 3 | go-live |
| GoLiveSignOff | `GoLiveSignOff` | 2 | go-live |

Notes:

- `SupportTicket` and `EscalationRule` were marked KEEP in `DATA_MODEL_DISPOSITION.md`, but today only the go-live and post-go-live modules use them.
- `FacilityIssue` stays until `apps/api/scripts/migrate-facility-issues-to-requests.ts` has been applied and verified (see `DATA_DISPOSITION_REPORT.md` section 1).
- `ErpMockSyncRun` belongs to the mock ERP provider, which is blocked in production.

### 4.2 Unused (no code or view reads or writes them)

| Model | SQL table | Why it is unused | Recommendation |
| --- | --- | --- | --- |
| CustomFieldValue | `CustomFieldValue` | `CustomFieldDefinition` is managed in enterprise-governance, but no code stores values. | Keep if custom fields are on the roadmap; otherwise drop both. |
| EmployeeRosterEntry | `EmployeeRosterEntry` | Workforce uses `EmployeeLeaveRequest`; rostering was never built. | Drop. |
| VendorContact | `VendorContact` | Supplier contact details live on `Supplier`. | Drop. |
| RepairWarranty | `RepairWarranty` | Duplicates `EntityWarranty` / `WarrantyClaim`, which the warranties module uses. | Drop. |
| UatScenarioExecution | `UatScenarioExecution` | Delivery-phase tracking; no module uses it. | Drop. |

Before dropping these:

- `scripts/validate-e2e-uat-go-live-controls.mjs` (check UAT-SAFE-011, run by `full-stack-e2e`) and `scripts/test/uat-result-contract.selftest.mjs` look for the text `model UatScenarioExecution` in the schema. Remove or repoint those checks in the same change. The selftest already fails today: it looks for `FORMAL_BUSINESS_UAT` in the schema, but that value lives in `apps/api/src/database/prisma-enums.ts`.
- `scripts/mongo-to-sqlserver/registry.ts` lists `RepairWarranty` for the legacy Mongo copy tool.
- `OrganizationUnit` is not in this list: `vw_rpt_dim_branch_site` joins it, so dropping it would break that view.

## 5. Compare the live database with this map

Run these yourself (they are read-only). They answer: are there tables in the database that the repo does not know about, and is the database behind or ahead of the migrations?

1. Migration state, from `maintainpro/`:

   ```bash
   npm run db:migrate:status
   ```

2. Exact difference between the live database and `schema.prisma`. Prints SQL but does not run it:

   ```bash
   npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script
   ```

   `DROP TABLE` lines in the output are tables that exist in the database but not in the repo. `CREATE TABLE` lines are tables the repo expects but the database is missing.

3. Tables, row counts, views, and triggers, in SSMS against `MaintainProDev` (or any other database you built by hand):

   ```sql
   SELECT s.name AS [schema], t.name AS [table], SUM(p.rows) AS [rows]
   FROM sys.tables t
   JOIN sys.schemas s ON s.schema_id = t.schema_id
   JOIN sys.partitions p ON p.object_id = t.object_id AND p.index_id IN (0, 1)
   GROUP BY s.name, t.name
   ORDER BY s.name, t.name;

   SELECT type_desc, name FROM sys.objects
   WHERE is_ms_shipped = 0 AND type IN ('V', 'TR', 'P', 'FN', 'IF', 'TF')
   ORDER BY type_desc, name;
   ```

   Expect 222 model tables plus `_prisma_migrations`, the 4 views, and the 9 triggers above. Anything else was not created by this repo.

## 6. Rules for changing tables

- Every change goes through a new folder in `prisma/migrations/`. No hand-made tables in SSMS; Prisma will not see them.
- Dropping a table: remove the model and its relation fields from `schema.prisma`, remove any module code, generate a migration, check the live row count is 0 (or export the data), and take a backup (`docs/SQLSERVER_BACKUP_RESTORE_RUNBOOK.md`).
- New tenant data needs `tenantId`, a tenant-scoped unique where a business key exists, and service code that filters by the caller's tenant.
- Update this map when a model is added, removed, or changes status.
