# Database table classification audit

**Status:** audit only. No table was dropped. No backup was taken because no destructive change was made.

| Fact | Value |
| --- | --- |
| Database | `MaintainProDev` on local SQL Server |
| Schema audited | `dbo` user tables from `sys.tables` |
| Prisma models | 217, all present as tables |
| User tables | 219 |
| Applied migration folders | 28 successful rows in `_prisma_migrations` |
| Rolled-back attempts | 9 unfinished rows kept as history; a finished row exists for each name |
| Views | `vw_rpt_dim_date`, `vw_rpt_dim_branch_site`, `vw_rpt_fact_maintenance`, `vw_rpt_fact_downtime` |
| Product stored procedures | none |
| SSMS diagram procedures | present, and they reference `sysdiagrams` |
| Business sample | 2 tenants, 15 users, 258 work orders, 7 maintenance requests, 7 assets, 6 vehicles, 12 spare parts |

Row counts come from `sys.partitions`. They are the catalog counts, not proof of recent activity. `modify_date` was recorded and not used to call a table unused.

## Counts

| Classification | Count |
| --- | ---: |
| ACTIVE | 191 |
| HISTORICAL | 9 |
| TECHNICAL | 17 |
| DEPRECATED-BUT-RETAINED | 2 |
| DELETE-CANDIDATE | 0 |
| Total | 219 |

## Delete candidates

None. Every product table is still a Prisma model, is still referenced by API code or a parent relation or a reporting view, or is the migration ledger. `sysdiagrams` is empty, but the database diagram procedures depend on it, so it does not pass the delete gate.

Five tables were already removed on 2026-09-30 by `20260930090000_drop_unused_tables`, and only because they were empty and unused: `EmployeeRosterEntry`, `VendorContact`, `RepairWarranty`, `CustomFieldValue`, `UatScenarioExecution`. They are not in this database.

## Special decisions

| Table | Classification | Why it stays |
| --- | --- | --- |
| GpsLocation | DEPRECATED-BUT-RETAINED | Live Map is retired. `vehicles.service` still lists samples and `fleet.service` can still insert one. Zero rows. Vehicle foreign key. |
| ErpMockSyncRun | DEPRECATED-BUT-RETAINED | Live Bileeta API stays deferred. Mock sync is blocked in production. |
| SparePart, WarehouseItemBalance, StockMovement, PartIssue, ErpImportBatch, ErpImportRow, ErpFieldMapping, ErpReconciliationMismatch, DomainEventOutbox | ACTIVE or TECHNICAL | Bileeta owns quantity. These hold the snapshot, mapping, consumption, cost, and pending acknowledgement. |
| OrganizationUnit | ACTIVE | Zero rows. `vw_rpt_dim_branch_site` joins it. A trigger enforces tenant parent integrity. |

## Every table

| Table | Rows | Prisma | Code / dependencies | Purpose | Classification | Reason | Risk | Action |
| --- | ---: | --- | --- | --- | --- | --- | --- | --- |
| AccidentEvidence | 0 | Yes | Prisma model; FK out 2; FK in 0; no trigger; no reporting view; no tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| AccidentReport | 0 | Yes | Prisma model; FK out 4; FK in 3; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| AnimalHealthRecord | 0 | Yes | Prisma model; FK out 1; FK in 0; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| AnimalProductionLog | 0 | Yes | Prisma model; FK out 1; FK in 0; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| ApprovalDecision | 0 | Yes | Prisma model; FK out 4; FK in 0; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| ApprovalDelegation | 0 | Yes | Prisma model; FK out 0; FK in 0; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| ApprovalRequest | 0 | Yes | Prisma model; FK out 3; FK in 2; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| ApprovalRule | 0 | Yes | Prisma model; FK out 3; FK in 2; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| ApprovalRuleLevel | 0 | Yes | Prisma model; FK out 4; FK in 0; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| ApprovalStep | 0 | Yes | Prisma model; FK out 4; FK in 1; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| Asset | 7 | Yes | Prisma model; FK out 9; FK in 11; trigger trg_Asset_no_hierarchy_cycle; no reporting view; tenantId | Business table with a database trigger | ACTIVE | Current API or reporting path reads or writes it. | HIGH | KEEP |
| AssetAttributeDefinition | 7 | Yes | Prisma model; FK out 2; FK in 0; no trigger; no reporting view; tenantId | Product table | ACTIVE | Current API or reporting path reads or writes it. | HIGH | KEEP |
| AssetCategoryMaster | 17 | Yes | Prisma model; FK out 2; FK in 2; no trigger; no reporting view; tenantId | Product table | ACTIVE | Current API or reporting path reads or writes it. | HIGH | KEEP |
| AssetDomain | 24 | Yes | Prisma model; FK out 1; FK in 4; no trigger; no reporting view; tenantId | Product table | ACTIVE | Current API or reporting path reads or writes it. | HIGH | KEEP |
| AssetMeter | 0 | Yes | Prisma model; FK out 3; FK in 3; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| AssetMeterReading | 0 | Yes | Prisma model; FK out 1; FK in 0; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| AssetTypeMaster | 24 | Yes | Prisma model; FK out 2; FK in 2; no trigger; no reporting view; tenantId | Product table | ACTIVE | Current API or reporting path reads or writes it. | HIGH | KEEP |
| AttendanceLog | 0 | Yes | Prisma model; FK out 1; FK in 0; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| BudgetCommitment | 0 | Yes | Prisma model; FK out 1; FK in 0; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| Building | 0 | Yes | Prisma model; FK out 2; FK in 1; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| BulkImportRow | 0 | Yes | Prisma model; FK out 1; FK in 0; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| BulkImportRun | 0 | Yes | Prisma model; FK out 2; FK in 1; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| BusinessException | 0 | Yes | Prisma model; FK out 1; FK in 0; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| CalibrationRecord | 0 | Yes | Prisma model; FK out 2; FK in 0; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| CapaAction | 2 | Yes | Prisma model; FK out 3; FK in 0; no trigger; no reporting view; tenantId | Product table | ACTIVE | Current API or reporting path reads or writes it. | HIGH | KEEP |
| ChangeRequest | 0 | Yes | Prisma model; FK out 1; FK in 0; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| ChecklistExecution | 0 | Yes | Prisma model; FK out 1; FK in 0; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| ChecklistTemplate | 0 | Yes | Prisma model; FK out 1; FK in 4; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| ChecklistTemplateItem | 0 | Yes | Prisma model; FK out 1; FK in 0; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| CleaningChecklist | 0 | Yes | Prisma model; FK out 1; FK in 0; no trigger; no reporting view; no tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| CleaningChecklistTemplate | 0 | Yes | Prisma model; FK out 1; FK in 0; no trigger; no reporting view; no tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| CleaningLocation | 3 | Yes | Prisma model; FK out 2; FK in 3; no trigger; no reporting view; tenantId | Product table | ACTIVE | Current API or reporting path reads or writes it. | HIGH | KEEP |
| CleaningVisit | 0 | Yes | Prisma model; FK out 4; FK in 1; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| ComplianceRequirement | 0 | Yes | Prisma model; FK out 1; FK in 0; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| ConditionEvent | 0 | Yes | Prisma model; FK out 3; FK in 0; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| ConditionMonitoringRule | 0 | Yes | Prisma model; FK out 1; FK in 1; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| CopilotConversation | 0 | Yes | Prisma model; FK out 1; FK in 2; no trigger; no reporting view; no tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| CopilotExchangeLog | 0 | Yes | Prisma model; FK out 2; FK in 0; no trigger; no reporting view; no tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| CopilotMessage | 0 | Yes | Prisma model; FK out 2; FK in 0; no trigger; no reporting view; no tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| CropCycle | 0 | Yes | Prisma model; FK out 1; FK in 2; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| CustomFieldDefinition | 0 | Yes | Prisma model; FK out 0; FK in 0; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| CutoverChecklistItem | 0 | Yes | Prisma model; FK out 1; FK in 0; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| DeliveryChecklist | 0 | Yes | Prisma model; FK out 1; FK in 1; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| DeliveryChecklistItem | 0 | Yes | Prisma model; FK out 1; FK in 0; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| DeliverySignOff | 0 | Yes | Prisma model; FK out 1; FK in 0; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| Department | 51 | Yes | Prisma model; FK out 3; FK in 8; no trigger; no reporting view; tenantId | Product table | ACTIVE | Current API or reporting path reads or writes it. | HIGH | KEEP |
| DowntimeSegment | 1 | Yes | Prisma model; FK out 4; FK in 0; no trigger; reporting view; tenantId | Used by a reporting view | ACTIVE | Current API or reporting path reads or writes it. | HIGH | KEEP |
| Driver | 3 | Yes | Prisma model; FK out 3; FK in 7; no trigger; no reporting view; tenantId | Product table | ACTIVE | Current API or reporting path reads or writes it. | HIGH | KEEP |
| Employee | 6 | Yes | Prisma model; FK out 3; FK in 2; no trigger; no reporting view; tenantId | Product table | ACTIVE | Current API or reporting path reads or writes it. | HIGH | KEEP |
| EmployeeLeaveRequest | 0 | Yes | Prisma model; FK out 3; FK in 0; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| Entitlement | 15 | Yes | Prisma model; FK out 1; FK in 0; no trigger; no reporting view; no tenantId | Product table | ACTIVE | Current API or reporting path reads or writes it. | HIGH | KEEP |
| EntityWarranty | 0 | Yes | Prisma model; FK out 2; FK in 1; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| ErpAccessChecklistItem | 15 | Yes | Prisma model; FK out 1; FK in 0; no trigger; no reporting view; tenantId | Inventory or Bileeta reconciliation | ACTIVE | Current API or reporting path reads or writes it. | HIGH | KEEP |
| ErpFieldMapping | 18 | Yes | Prisma model; FK out 1; FK in 0; no trigger; no reporting view; tenantId | Inventory or Bileeta reconciliation | ACTIVE | Current API or reporting path reads or writes it. | HIGH | KEEP |
| ErpImportBatch | 0 | Yes | Prisma model; FK out 1; FK in 2; no trigger; no reporting view; tenantId | Inventory or Bileeta reconciliation | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| ErpImportRow | 0 | Yes | Prisma model; FK out 3; FK in 0; no trigger; no reporting view; tenantId | Inventory or Bileeta reconciliation | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| ErpReconciliationMismatch | 0 | Yes | Prisma model; FK out 1; FK in 0; no trigger; no reporting view; tenantId | Inventory or Bileeta reconciliation | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| EscalationRule | 0 | Yes | Prisma model; FK out 1; FK in 0; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| EvidenceAttachment | 0 | Yes | Prisma model; FK out 6; FK in 0; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| FacilityIssue | 0 | Yes | Prisma model; FK out 7; FK in 1; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| FarmExpense | 0 | Yes | Prisma model; FK out 0; FK in 0; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| FarmIncome | 0 | Yes | Prisma model; FK out 0; FK in 0; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| FarmWorker | 0 | Yes | Prisma model; FK out 0; FK in 1; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| FeedingLog | 0 | Yes | Prisma model; FK out 1; FK in 0; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| Field | 0 | Yes | Prisma model; FK out 0; FK in 4; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| Floor | 0 | Yes | Prisma model; FK out 2; FK in 1; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| FuelLog | 0 | Yes | Prisma model; FK out 2; FK in 0; no trigger; no reporting view; no tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| FunctionalLocation | 1 | Yes | Prisma model; FK out 4; FK in 5; no trigger; no reporting view; tenantId | Product table | ACTIVE | Current API or reporting path reads or writes it. | HIGH | KEEP |
| GoLiveDecision | 0 | Yes | Prisma model; FK out 1; FK in 0; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| GoLiveSignOff | 0 | Yes | Prisma model; FK out 1; FK in 0; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| HarvestRecord | 0 | Yes | Prisma model; FK out 1; FK in 0; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| HypercarePlan | 0 | Yes | Prisma model; FK out 1; FK in 0; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| Inspection | 2 | Yes | Prisma model; FK out 5; FK in 2; no trigger; no reporting view; tenantId | Product table | ACTIVE | Current API or reporting path reads or writes it. | HIGH | KEEP |
| InspectionFinding | 0 | Yes | Prisma model; FK out 2; FK in 0; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| InspectionTemplate | 0 | Yes | Prisma model; FK out 2; FK in 1; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| InstalledPart | 0 | Yes | Prisma model; FK out 4; FK in 0; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| InsuranceClaim | 0 | Yes | Prisma model; FK out 4; FK in 0; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| InventoryImportRow | 6 | Yes | Prisma model; FK out 1; FK in 0; no trigger; no reporting view; tenantId | Product table | ACTIVE | Current API or reporting path reads or writes it. | HIGH | KEEP |
| InventoryImportRun | 2 | Yes | Prisma model; FK out 2; FK in 1; no trigger; no reporting view; tenantId | Product table | ACTIVE | Current API or reporting path reads or writes it. | HIGH | KEEP |
| IrrigationLog | 0 | Yes | Prisma model; FK out 1; FK in 0; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| JobCode | 0 | Yes | Prisma model; FK out 2; FK in 1; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| JobCodeRequiredPart | 0 | Yes | Prisma model; FK out 1; FK in 0; no trigger; no reporting view; no tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| LivestockAnimal | 0 | Yes | Prisma model; FK out 0; FK in 3; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| LotoRecord | 0 | Yes | Prisma model; FK out 6; FK in 0; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| MaintenanceAnalysisCode | 23 | Yes | Prisma model; FK out 1; FK in 6; no trigger; no reporting view; tenantId | Product table | ACTIVE | Current API or reporting path reads or writes it. | HIGH | KEEP |
| MaintenanceForecast | 0 | Yes | Prisma model; FK out 2; FK in 0; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| MaintenanceJobCategory | 33 | Yes | Prisma model; FK out 2; FK in 1; no trigger; no reporting view; tenantId | Product table | ACTIVE | Current API or reporting path reads or writes it. | HIGH | KEEP |
| MaintenanceReasonCode | 15 | Yes | Prisma model; FK out 1; FK in 0; no trigger; no reporting view; tenantId | Product table | ACTIVE | Current API or reporting path reads or writes it. | HIGH | KEEP |
| MaintenanceRequest | 7 | Yes | Prisma model; FK out 13; FK in 2; trigger trg_MaintenanceRequest_tenant_asset; no reporting view; tenantId | Business table with a database trigger | ACTIVE | Current API or reporting path reads or writes it. | HIGH | KEEP |
| MaintenanceSchedule | 0 | Yes | Prisma model; FK out 2; FK in 3; no trigger; no reporting view; no tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| MaintenanceTemplate | 3 | Yes | Prisma model; FK out 4; FK in 2; no trigger; no reporting view; tenantId | Product table | ACTIVE | Current API or reporting path reads or writes it. | HIGH | KEEP |
| MeterReading | 240 | Yes | Prisma model; FK out 1; FK in 0; no trigger; no reporting view; no tenantId | Product table | ACTIVE | Current API or reporting path reads or writes it. | HIGH | KEEP |
| Notification | 33 | Yes | Prisma model; FK out 1; FK in 0; no trigger; no reporting view; no tenantId | Product table | ACTIVE | Current API or reporting path reads or writes it. | HIGH | KEEP |
| OperationalAlert | 0 | Yes | Prisma model; FK out 0; FK in 0; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| OrganizationUnit | 0 | Yes | Prisma model; FK out 2; FK in 0; trigger trg_OrganizationUnit_tenant_parent; reporting view; tenantId | Business table with a database trigger | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| PartCompatibility | 0 | Yes | Prisma model; FK out 2; FK in 0; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| PartIssue | 2 | Yes | Prisma model; FK out 5; FK in 0; no trigger; no reporting view; tenantId | Inventory or Bileeta reconciliation | ACTIVE | Current API or reporting path reads or writes it. | HIGH | KEEP |
| PartRequest | 3 | Yes | Prisma model; FK out 4; FK in 4; trigger trg_PartRequest_tenant_wo; no reporting view; tenantId | Business table with a database trigger | ACTIVE | Current API or reporting path reads or writes it. | HIGH | KEEP |
| PartRequestApproval | 6 | Yes | Prisma model; FK out 3; FK in 0; no trigger; no reporting view; tenantId | Product table | ACTIVE | Current API or reporting path reads or writes it. | HIGH | KEEP |
| Permission | 221 | Yes | Prisma model; FK out 0; FK in 1; no trigger; no reporting view; no tenantId | Product table | ACTIVE | Current API or reporting path reads or writes it. | HIGH | KEEP |
| PilotRollout | 0 | Yes | Prisma model; FK out 1; FK in 0; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| Plan | 3 | Yes | Prisma model; FK out 0; FK in 2; no trigger; no reporting view; no tenantId | Product table | ACTIVE | Current API or reporting path reads or writes it. | HIGH | KEEP |
| PmAutoGeneration | 1 | Yes | Prisma model; FK out 1; FK in 0; no trigger; no reporting view; tenantId | Product table | ACTIVE | Current API or reporting path reads or writes it. | HIGH | KEEP |
| PmOccurrence | 1 | Yes | Prisma model; FK out 3; FK in 0; no trigger; no reporting view; tenantId | Product table | ACTIVE | Current API or reporting path reads or writes it. | HIGH | KEEP |
| PmPlan | 1 | Yes | Prisma model; FK out 6; FK in 6; no trigger; no reporting view; tenantId | Product table | ACTIVE | Current API or reporting path reads or writes it. | HIGH | KEEP |
| PmPlanRequiredPart | 0 | Yes | Prisma model; FK out 1; FK in 0; no trigger; no reporting view; no tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| PmTrigger | 1 | Yes | Prisma model; FK out 2; FK in 0; no trigger; no reporting view; tenantId | Product table | ACTIVE | Current API or reporting path reads or writes it. | HIGH | KEEP |
| PredictiveLog | 0 | Yes | Prisma model; FK out 1; FK in 0; no trigger; no reporting view; no tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| PrioritySlaRule | 4 | Yes | Prisma model; FK out 1; FK in 0; no trigger; no reporting view; tenantId | Product table | ACTIVE | Current API or reporting path reads or writes it. | HIGH | KEEP |
| ProcurementRecommendation | 0 | Yes | Prisma model; FK out 2; FK in 0; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| Property | 0 | Yes | Prisma model; FK out 1; FK in 1; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| PurchaseOrder | 0 | Yes | Prisma model; FK out 3; FK in 4; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| PurchaseOrderApproval | 0 | Yes | Prisma model; FK out 3; FK in 0; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| PurchaseOrderErpSync | 0 | Yes | Prisma model; FK out 3; FK in 0; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| PurchaseOrderLine | 0 | Yes | Prisma model; FK out 4; FK in 1; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| PurchaseReceipt | 0 | Yes | Prisma model; FK out 3; FK in 1; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| PurchaseReceiptLine | 0 | Yes | Prisma model; FK out 3; FK in 0; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| QaIssue | 0 | Yes | Prisma model; FK out 1; FK in 2; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| QaIssueRca | 0 | Yes | Prisma model; FK out 1; FK in 0; no trigger; no reporting view; no tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| QaRegressionTest | 0 | Yes | Prisma model; FK out 1; FK in 0; no trigger; no reporting view; no tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| RcaCase | 2 | Yes | Prisma model; FK out 3; FK in 1; no trigger; no reporting view; tenantId | Product table | ACTIVE | Current API or reporting path reads or writes it. | HIGH | KEEP |
| ReliabilityPolicy | 1 | Yes | Prisma model; FK out 1; FK in 0; no trigger; no reporting view; tenantId | Product table | ACTIVE | Current API or reporting path reads or writes it. | HIGH | KEEP |
| RequestProblemCategory | 11 | Yes | Prisma model; FK out 1; FK in 1; no trigger; no reporting view; tenantId | Product table | ACTIVE | Current API or reporting path reads or writes it. | HIGH | KEEP |
| Role | 27 | Yes | Prisma model; FK out 1; FK in 2; no trigger; no reporting view; tenantId | Product table | ACTIVE | Current API or reporting path reads or writes it. | HIGH | KEEP |
| RolePermission | 1116 | Yes | Prisma model; FK out 2; FK in 0; no trigger; no reporting view; no tenantId | Product table | ACTIVE | Current API or reporting path reads or writes it. | HIGH | KEEP |
| RollbackPlan | 0 | Yes | Prisma model; FK out 1; FK in 0; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| RolloutWave | 0 | Yes | Prisma model; FK out 1; FK in 0; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| Room | 0 | Yes | Prisma model; FK out 2; FK in 1; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| Site | 1 | Yes | Prisma model; FK out 1; FK in 5; no trigger; reporting view; tenantId | Used by a reporting view | ACTIVE | Current API or reporting path reads or writes it. | HIGH | KEEP |
| SoDPolicy | 0 | Yes | Prisma model; FK out 0; FK in 0; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| SoftwareRelease | 0 | Yes | Prisma model; FK out 1; FK in 0; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| SoilTest | 0 | Yes | Prisma model; FK out 1; FK in 0; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| SparePart | 12 | Yes | Prisma model; FK out 2; FK in 10; no trigger; no reporting view; tenantId | Inventory or Bileeta reconciliation | ACTIVE | ERP snapshot. Bileeta owns quantity. MaintainPro does not treat this as a local stock ledger. | HIGH | KEEP |
| SprayLog | 0 | Yes | Prisma model; FK out 2; FK in 0; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| StockCountLine | 0 | Yes | Prisma model; FK out 2; FK in 0; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| StockCountSession | 0 | Yes | Prisma model; FK out 2; FK in 1; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| StockMovement | 1 | Yes | Prisma model; FK out 5; FK in 0; no trigger; no reporting view; tenantId | Inventory or Bileeta reconciliation | ACTIVE | Current API or reporting path reads or writes it. | HIGH | KEEP |
| StripeCustomer | 0 | Yes | Prisma model; FK out 1; FK in 0; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| StripeInvoice | 0 | Yes | Prisma model; FK out 2; FK in 0; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| Subscription | 1 | Yes | Prisma model; FK out 2; FK in 1; no trigger; no reporting view; tenantId | Product table | ACTIVE | Current API or reporting path reads or writes it. | HIGH | KEEP |
| Supplier | 0 | Yes | Prisma model; FK out 1; FK in 9; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| SupportHandover | 0 | Yes | Prisma model; FK out 1; FK in 0; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| SupportTicket | 0 | Yes | Prisma model; FK out 1; FK in 0; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| TemporaryRepairRecord | 0 | Yes | Prisma model; FK out 1; FK in 0; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| Tenant | 2 | Yes | Prisma model; FK out 0; FK in 148; no trigger; no reporting view; no tenantId | Product table | ACTIVE | Current API or reporting path reads or writes it. | HIGH | KEEP |
| TenantInvitation | 2 | Yes | Prisma model; FK out 2; FK in 0; no trigger; no reporting view; tenantId | Product table | ACTIVE | Current API or reporting path reads or writes it. | HIGH | KEEP |
| TenantMembership | 15 | Yes | Prisma model; FK out 2; FK in 0; no trigger; no reporting view; tenantId | Product table | ACTIVE | Current API or reporting path reads or writes it. | HIGH | KEEP |
| TraceabilityRecord | 0 | Yes | Prisma model; FK out 0; FK in 1; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| TraceabilitySprayLink | 0 | Yes | Prisma model; FK out 1; FK in 0; no trigger; no reporting view; no tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| TrafficFine | 0 | Yes | Prisma model; FK out 4; FK in 1; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| TrainingSession | 0 | Yes | Prisma model; FK out 1; FK in 0; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| TripLog | 0 | Yes | Prisma model; FK out 2; FK in 0; no trigger; no reporting view; no tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| UsageEvent | 0 | Yes | Prisma model; FK out 1; FK in 0; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| UsageMetric | 0 | Yes | Prisma model; FK out 1; FK in 0; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| User | 15 | Yes | Prisma model; FK out 3; FK in 82; no trigger; no reporting view; tenantId | Product table | ACTIVE | Current API or reporting path reads or writes it. | HIGH | KEEP |
| UserInvitation | 1 | Yes | Prisma model; FK out 3; FK in 0; no trigger; no reporting view; tenantId | Product table | ACTIVE | Current API or reporting path reads or writes it. | HIGH | KEEP |
| UserSkill | 4 | Yes | Prisma model; FK out 1; FK in 0; no trigger; no reporting view; no tenantId | Product table | ACTIVE | Current API or reporting path reads or writes it. | HIGH | KEEP |
| UtilityBill | 240 | Yes | Prisma model; FK out 2; FK in 0; no trigger; no reporting view; tenantId | Product table | ACTIVE | Current API or reporting path reads or writes it. | HIGH | KEEP |
| UtilityMeter | 2 | Yes | Prisma model; FK out 1; FK in 2; no trigger; no reporting view; tenantId | Product table | ACTIVE | Current API or reporting path reads or writes it. | HIGH | KEEP |
| Vehicle | 6 | Yes | Prisma model; FK out 4; FK in 21; no trigger; no reporting view; tenantId | Product table | ACTIVE | Current API or reporting path reads or writes it. | HIGH | KEEP |
| VehicleAssignment | 0 | Yes | Prisma model; FK out 3; FK in 0; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| VehicleBattery | 0 | Yes | Prisma model; FK out 2; FK in 0; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| VehicleDocument | 5 | Yes | Prisma model; FK out 4; FK in 0; no trigger; no reporting view; tenantId | Product table | ACTIVE | Current API or reporting path reads or writes it. | HIGH | KEEP |
| VehicleGateMovement | 5 | Yes | Prisma model; FK out 3; FK in 0; no trigger; no reporting view; no tenantId | Product table | ACTIVE | Current API or reporting path reads or writes it. | HIGH | KEEP |
| VehicleMeterLog | 230 | Yes | Prisma model; FK out 2; FK in 0; no trigger; no reporting view; no tenantId | Product table | ACTIVE | Current API or reporting path reads or writes it. | HIGH | KEEP |
| VehicleTyre | 0 | Yes | Prisma model; FK out 2; FK in 0; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| VendorContract | 0 | Yes | Prisma model; FK out 2; FK in 2; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| VendorContractAsset | 0 | Yes | Prisma model; FK out 1; FK in 0; no trigger; no reporting view; no tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| VendorContractSite | 0 | Yes | Prisma model; FK out 1; FK in 0; no trigger; no reporting view; no tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| VendorInvoice | 0 | Yes | Prisma model; FK out 3; FK in 0; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| VendorPortalAccess | 0 | Yes | Prisma model; FK out 2; FK in 0; trigger trg_VendorPortalAccess_tenant; no reporting view; tenantId | Business table with a database trigger | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| VendorQuotation | 0 | Yes | Prisma model; FK out 3; FK in 0; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| VendorRepairCase | 0 | Yes | Prisma model; FK out 3; FK in 2; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| Warehouse | 1 | Yes | Prisma model; FK out 1; FK in 4; no trigger; no reporting view; tenantId | Product table | ACTIVE | Current API or reporting path reads or writes it. | HIGH | KEEP |
| WarehouseItemBalance | 1 | Yes | Prisma model; FK out 3; FK in 0; no trigger; no reporting view; tenantId | Inventory or Bileeta reconciliation | ACTIVE | ERP snapshot. Bileeta owns quantity. MaintainPro does not treat this as a local stock ledger. | HIGH | KEEP |
| WarrantyClaim | 0 | Yes | Prisma model; FK out 5; FK in 0; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| WeatherLog | 0 | Yes | Prisma model; FK out 0; FK in 0; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| WorkflowDefinition | 0 | Yes | Prisma model; FK out 1; FK in 1; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| WorkflowVersion | 0 | Yes | Prisma model; FK out 1; FK in 1; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| WorkOrder | 258 | Yes | Prisma model; FK out 27; FK in 27; trigger trg_WorkOrder_tenant_refs; reporting view; tenantId | Business table with a database trigger | ACTIVE | Current API or reporting path reads or writes it. | HIGH | KEEP |
| WorkOrderAssignee | 5 | Yes | Prisma model; FK out 4; FK in 0; no trigger; no reporting view; tenantId | Product table | ACTIVE | Current API or reporting path reads or writes it. | HIGH | KEEP |
| WorkOrderClassification | 80 | Yes | Prisma model; FK out 10; FK in 0; no trigger; no reporting view; tenantId | Product table | ACTIVE | Current API or reporting path reads or writes it. | HIGH | KEEP |
| WorkOrderCompletion | 220 | Yes | Prisma model; FK out 6; FK in 0; no trigger; no reporting view; tenantId | Product table | ACTIVE | Current API or reporting path reads or writes it. | HIGH | KEEP |
| WorkOrderCostSnapshot | 3 | Yes | Prisma model; FK out 2; FK in 0; no trigger; no reporting view; tenantId | Product table | ACTIVE | Current API or reporting path reads or writes it. | HIGH | KEEP |
| WorkOrderExecution | 215 | Yes | Prisma model; FK out 4; FK in 0; no trigger; no reporting view; tenantId | Product table | ACTIVE | Current API or reporting path reads or writes it. | HIGH | KEEP |
| WorkOrderLabourEntry | 7 | Yes | Prisma model; FK out 2; FK in 0; no trigger; no reporting view; tenantId | Product table | ACTIVE | Current API or reporting path reads or writes it. | HIGH | KEEP |
| WorkOrderPart | 3 | Yes | Prisma model; FK out 4; FK in 0; no trigger; no reporting view; tenantId | Product table | ACTIVE | Current API or reporting path reads or writes it. | HIGH | KEEP |
| WorkOrderPlanning | 196 | Yes | Prisma model; FK out 2; FK in 0; no trigger; no reporting view; tenantId | Product table | ACTIVE | Current API or reporting path reads or writes it. | HIGH | KEEP |
| WorkOrderSafety | 0 | Yes | Prisma model; FK out 2; FK in 0; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| WorkOrderTaxonomy | 139 | Yes | Prisma model; FK out 2; FK in 6; no trigger; no reporting view; tenantId | Product table | ACTIVE | Current API or reporting path reads or writes it. | HIGH | KEEP |
| WorkPermit | 0 | Yes | Prisma model; FK out 4; FK in 1; no trigger; no reporting view; tenantId | Product table | ACTIVE | Empty in this development database, but the application or a parent relation still owns it. | HIGH | KEEP |
| ErpMockSyncRun | 0 | Yes | Prisma model; FK out 1; FK in 0; no trigger; no reporting view; tenantId | Mock ERP sync attempts | DEPRECATED-BUT-RETAINED | Live Bileeta API is deferred. The mock provider is blocked in production, but the module still owns this table. | HIGH | KEEP |
| GpsLocation | 0 | Yes | Prisma model; FK out 1; FK in 0; no trigger; no reporting view; no tenantId | Vehicle position samples | DEPRECATED-BUT-RETAINED | Live Map is retired. Vehicle history still queries the table and the fleet service can still insert a sample. Zero rows today. Do not drop. | HIGH | KEEP |
| AssetLocationHistory | 0 | Yes | Prisma model; FK out 2; FK in 0; no trigger; no reporting view; tenantId | Product table | HISTORICAL | Append-only or correction history still required for traceability. Not a master to drop. | HIGH | KEEP |
| ConfigChangeHistory | 14 | Yes | Prisma model; FK out 2; FK in 0; trigger trg_ConfigChangeHistory_immutable; no reporting view; tenantId | Business table with a database trigger | HISTORICAL | Append-only or correction history still required for traceability. Not a master to drop. | HIGH | KEEP |
| MaintenanceLog | 0 | Yes | Prisma model; FK out 4; FK in 0; no trigger; no reporting view; no tenantId | Product table | HISTORICAL | Append-only or correction history still required for traceability. Not a master to drop. | HIGH | KEEP |
| MaintenanceRequestHistory | 26 | Yes | Prisma model; FK out 3; FK in 0; no trigger; no reporting view; tenantId | Product table | HISTORICAL | Append-only or correction history still required for traceability. Not a master to drop. | HIGH | KEEP |
| MeterCorrection | 0 | Yes | Prisma model; FK out 1; FK in 0; trigger trg_MeterCorrection_tenant_meter; no reporting view; tenantId | Business table with a database trigger | HISTORICAL | Append-only or correction history still required for traceability. Not a master to drop. | HIGH | KEEP |
| PmPlanRevision | 1 | Yes | Prisma model; FK out 1; FK in 0; no trigger; no reporting view; tenantId | Product table | HISTORICAL | Append-only or correction history still required for traceability. Not a master to drop. | HIGH | KEEP |
| VehicleHealthSnapshot | 0 | Yes | Prisma model; FK out 2; FK in 0; no trigger; no reporting view; tenantId | Product table | HISTORICAL | Append-only or correction history still required for traceability. Not a master to drop. | HIGH | KEEP |
| WorkOrderHoldHistory | 2 | Yes | Prisma model; FK out 2; FK in 0; no trigger; no reporting view; tenantId | Product table | HISTORICAL | Append-only or correction history still required for traceability. Not a master to drop. | HIGH | KEEP |
| WorkOrderStatusHistory | 64 | Yes | Prisma model; FK out 2; FK in 0; no trigger; no reporting view; tenantId | Product table | HISTORICAL | Append-only or correction history still required for traceability. Not a master to drop. | HIGH | KEEP |
| _prisma_migrations | 37 | No | No Prisma model; FK out 0; FK in 0; no trigger; no reporting view; no tenantId | Prisma migration ledger | TECHNICAL | Required to apply future migrations. 28 successful migrations; earlier failed attempts are rolled back. | HIGH | KEEP |
| AppSetting | 5 | Yes | Prisma model; FK out 0; FK in 0; no trigger; no reporting view; no tenantId | Product table | TECHNICAL | Required by sessions, outbox, idempotency, settings, or audit. | HIGH | KEEP |
| AuditLog | 2080 | Yes | Prisma model; FK out 2; FK in 0; trigger trg_AuditLog_immutable; no reporting view; tenantId | Business table with a database trigger | TECHNICAL | Required by sessions, outbox, idempotency, settings, or audit. | HIGH | KEEP |
| DomainEventOutbox | 6 | Yes | Prisma model; FK out 1; FK in 0; no trigger; no reporting view; tenantId | Inventory or Bileeta reconciliation | TECHNICAL | Pending Bileeta acknowledgement ledger. Drain must not mark stock events processed. | HIGH | KEEP |
| InventoryIdempotency | 1 | Yes | Prisma model; FK out 1; FK in 0; no trigger; no reporting view; tenantId | Product table | TECHNICAL | Required by sessions, outbox, idempotency, settings, or audit. | HIGH | KEEP |
| InventoryStockIssueIdempotency | 0 | Yes | Prisma model; FK out 0; FK in 0; no trigger; no reporting view; tenantId | Product table | TECHNICAL | Required by sessions, outbox, idempotency, settings, or audit. | HIGH | KEEP |
| NumberingSequence | 0 | Yes | Prisma model; FK out 1; FK in 0; no trigger; no reporting view; tenantId | Product table | TECHNICAL | Required by sessions, outbox, idempotency, settings, or audit. | HIGH | KEEP |
| OutboundWebhook | 0 | Yes | Prisma model; FK out 0; FK in 0; no trigger; no reporting view; tenantId | Product table | TECHNICAL | Required by sessions, outbox, idempotency, settings, or audit. | HIGH | KEEP |
| OutboundWebhookDelivery | 0 | Yes | Prisma model; FK out 0; FK in 0; no trigger; no reporting view; tenantId | Product table | TECHNICAL | Required by sessions, outbox, idempotency, settings, or audit. | HIGH | KEEP |
| PasswordResetToken | 1 | Yes | Prisma model; FK out 1; FK in 0; no trigger; no reporting view; no tenantId | Product table | TECHNICAL | Required by sessions, outbox, idempotency, settings, or audit. | HIGH | KEEP |
| PurchaseReceiptIdempotency | 0 | Yes | Prisma model; FK out 1; FK in 0; no trigger; no reporting view; tenantId | Product table | TECHNICAL | Required by sessions, outbox, idempotency, settings, or audit. | HIGH | KEEP |
| RefreshToken | 356 | Yes | Prisma model; FK out 2; FK in 0; no trigger; no reporting view; tenantId | Product table | TECHNICAL | Required by sessions, outbox, idempotency, settings, or audit. | HIGH | KEEP |
| ReplicationOutbox | 128 | Yes | Prisma model; FK out 0; FK in 0; no trigger; no reporting view; tenantId | Product table | TECHNICAL | Required by sessions, outbox, idempotency, settings, or audit. | HIGH | KEEP |
| SecurityEvent | 6 | Yes | Prisma model; FK out 1; FK in 0; no trigger; no reporting view; tenantId | Product table | TECHNICAL | Required by sessions, outbox, idempotency, settings, or audit. | HIGH | KEEP |
| ServiceApiKey | 0 | Yes | Prisma model; FK out 0; FK in 0; no trigger; no reporting view; tenantId | Product table | TECHNICAL | Required by sessions, outbox, idempotency, settings, or audit. | HIGH | KEEP |
| sysdiagrams | 0 | No | No Prisma model; FK out 0; FK in 0; no trigger; no reporting view; no tenantId | SQL Server diagram catalog created by SSMS | TECHNICAL | Empty SSMS diagram store. Diagram procedures in this database reference it, so it fails the delete gate. | LOW for product data, HIGH if diagram procedures are dropped with it | KEEP |
| TenantFeatureFlag | 16 | Yes | Prisma model; FK out 2; FK in 0; no trigger; no reporting view; tenantId | Product table | TECHNICAL | Required by sessions, outbox, idempotency, settings, or audit. | HIGH | KEEP |

## Backup

Not created. No `DROP TABLE` is proposed for execution. If a later approval adds a candidate, take a full `MaintainProDev` backup first and export that table before a migration removes it.

## Rollback

Nothing changed. Restore is not required for this audit.
