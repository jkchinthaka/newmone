-- MP-003 — tenant-scoped business-key uniqueness.
--
-- Converts nine business-key columns that were incorrectly enforced as PLATFORM-GLOBAL unique
-- (a leftover Mongo-era assumption) to TENANT-SCOPED unique (@@unique([tenantId, <key>])):
--   Asset.assetTag, Vehicle.registrationNo, Vehicle.vin, Driver.licenseNumber,
--   WorkOrder.woNumber, SparePart.partNumber, UtilityMeter.meterNumber,
--   AccidentReport.reportNumber, InsuranceClaim.claimNumber, TrafficFine.fineNumber.
--
-- Evidence this was a genuine bug, not a deliberate design (see
-- docs/remediation/MP-003-TENANT-UNIQUENESS-MIGRATION-PLAN.md and the application-code
-- comments on each field in schema.prisma for the specific evidence per model):
--   - InventoryService.createPart() already ran a { tenantId, partNumber } duplicate check with
--     the message "Part number must be unique within tenant context" — application intent was
--     already tenant-scoped; the DB constraint was stricter (global) than the app assumed.
--   - WorkOrdersService.nextWoNumber() / AccidentsService.nextReportNumber() /
--     InsuranceClaimsService.nextClaimNumber() / TrafficFinesService.nextFineNumber() all
--     generate "<PREFIX>-<year>-NNNN" scoped to the current tenant only — under the old global
--     constraint, two different tenants' first record of a year would both compute the same
--     number and the second tenant's create would fail.
--   - vehicle-master-import.ts's VIN duplicate check has only ever compared against
--     `prisma.vehicle.findMany({ where: { tenantId } })` — i.e. VIN uniqueness was already only
--     ever validated per tenant in application code, never platform-wide.
--
-- NOT changed in this migration (deliberately kept global — see schema.prisma comments):
--   - CleaningLocation.qrCode: cryptographically random value, resolved by
--     `findUnique({ where: { qrCode } })` with no tenant context available at scan time by
--     design (a physical QR sticker scan), with tenant isolation enforced at the application
--     layer instead (CleaningService.scanVisit()'s explicit post-lookup tenant check).
--
-- tenantId nullability: all nine models had `tenantId String?` even though no application code
-- path ever created one with tenantId = NULL and the live database has zero such rows (verified
-- in this migration's preflight). A nullable tenantId would undermine the new compound unique
-- constraint (SQL Server, like other SQL databases, treats NULL as never-equal-to-NULL for
-- uniqueness, so multiple untenanted rows could share the same business key without violating
-- the constraint) — so tenantId is made required (NOT NULL) for all nine models.
--
-- SQL Server will not ALTER COLUMN a column that any index depends on ("The index 'X' is
-- dependent on column 'tenantId'" / error 5074), and every one of these tables has a plain
-- @@index([tenantId]) plus, on several, composite @@index([tenantId, ...]) indexes. Each of
-- those tenantId-dependent indexes is dropped before the ALTER COLUMN and recreated identically
-- afterward (verified against live sys.indexes/sys.index_columns immediately before writing
-- this migration — none of them have a filter_definition, so plain CREATE INDEX suffices).

-- ============================================================
-- Asset.assetTag (dependent indexes: Asset_tenantId_idx + 9 composite tenantId,* indexes)
-- ============================================================
IF EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = 'Asset_assetTag_key' AND parent_object_id = OBJECT_ID('dbo.Asset'))
  ALTER TABLE [dbo].[Asset] DROP CONSTRAINT [Asset_assetTag_key];

DROP INDEX IF EXISTS [Asset_tenantId_idx] ON [dbo].[Asset];
DROP INDEX IF EXISTS [Asset_tenantId_siteId_idx] ON [dbo].[Asset];
DROP INDEX IF EXISTS [Asset_tenantId_functionalLocationId_idx] ON [dbo].[Asset];
DROP INDEX IF EXISTS [Asset_tenantId_domainId_idx] ON [dbo].[Asset];
DROP INDEX IF EXISTS [Asset_tenantId_categoryMasterId_idx] ON [dbo].[Asset];
DROP INDEX IF EXISTS [Asset_tenantId_typeMasterId_idx] ON [dbo].[Asset];
DROP INDEX IF EXISTS [Asset_tenantId_parentAssetId_idx] ON [dbo].[Asset];
DROP INDEX IF EXISTS [Asset_tenantId_criticalityLevel_idx] ON [dbo].[Asset];
DROP INDEX IF EXISTS [Asset_tenantId_serialNumber_idx] ON [dbo].[Asset];
DROP INDEX IF EXISTS [Asset_tenantId_isActive_idx] ON [dbo].[Asset];

ALTER TABLE [dbo].[Asset] ALTER COLUMN [tenantId] NVARCHAR(36) NOT NULL;
ALTER TABLE [dbo].[Asset] ALTER COLUMN [assetTag] NVARCHAR(64) NOT NULL;

CREATE NONCLUSTERED INDEX [Asset_tenantId_idx] ON [dbo].[Asset]([tenantId]);
CREATE NONCLUSTERED INDEX [Asset_tenantId_siteId_idx] ON [dbo].[Asset]([tenantId], [siteId]);
CREATE NONCLUSTERED INDEX [Asset_tenantId_functionalLocationId_idx] ON [dbo].[Asset]([tenantId], [functionalLocationId]);
CREATE NONCLUSTERED INDEX [Asset_tenantId_domainId_idx] ON [dbo].[Asset]([tenantId], [domainId]);
CREATE NONCLUSTERED INDEX [Asset_tenantId_categoryMasterId_idx] ON [dbo].[Asset]([tenantId], [categoryMasterId]);
CREATE NONCLUSTERED INDEX [Asset_tenantId_typeMasterId_idx] ON [dbo].[Asset]([tenantId], [typeMasterId]);
CREATE NONCLUSTERED INDEX [Asset_tenantId_parentAssetId_idx] ON [dbo].[Asset]([tenantId], [parentAssetId]);
CREATE NONCLUSTERED INDEX [Asset_tenantId_criticalityLevel_idx] ON [dbo].[Asset]([tenantId], [criticalityLevel]);
CREATE NONCLUSTERED INDEX [Asset_tenantId_serialNumber_idx] ON [dbo].[Asset]([tenantId], [serialNumber]);
CREATE NONCLUSTERED INDEX [Asset_tenantId_isActive_idx] ON [dbo].[Asset]([tenantId], [isActive]);

ALTER TABLE [dbo].[Asset] ADD CONSTRAINT [Asset_tenantId_assetTag_key] UNIQUE NONCLUSTERED ([tenantId], [assetTag]);

-- ============================================================
-- Vehicle.registrationNo, Vehicle.vin (dependent: Vehicle_tenantId_idx,
-- Vehicle_tenantId_status_nextServiceDate_idx)
-- ============================================================
IF EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = 'Vehicle_registrationNo_key' AND parent_object_id = OBJECT_ID('dbo.Vehicle'))
  ALTER TABLE [dbo].[Vehicle] DROP CONSTRAINT [Vehicle_registrationNo_key];
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'Vehicle_vin_key' AND object_id = OBJECT_ID('dbo.Vehicle'))
  DROP INDEX [Vehicle_vin_key] ON [dbo].[Vehicle];

DROP INDEX IF EXISTS [Vehicle_tenantId_idx] ON [dbo].[Vehicle];
DROP INDEX IF EXISTS [Vehicle_tenantId_status_nextServiceDate_idx] ON [dbo].[Vehicle];

ALTER TABLE [dbo].[Vehicle] ALTER COLUMN [tenantId] NVARCHAR(36) NOT NULL;

CREATE NONCLUSTERED INDEX [Vehicle_tenantId_idx] ON [dbo].[Vehicle]([tenantId]);
CREATE NONCLUSTERED INDEX [Vehicle_tenantId_status_nextServiceDate_idx] ON [dbo].[Vehicle]([tenantId], [status], [nextServiceDate]);

ALTER TABLE [dbo].[Vehicle] ADD CONSTRAINT [Vehicle_tenantId_registrationNo_key] UNIQUE NONCLUSTERED ([tenantId], [registrationNo]);
CREATE UNIQUE NONCLUSTERED INDEX [Vehicle_tenantId_vin_key] ON [dbo].[Vehicle]([tenantId], [vin]) WHERE [vin] IS NOT NULL;

-- ============================================================
-- Driver.licenseNumber (dependent: Driver_tenantId_idx)
-- ============================================================
IF EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = 'Driver_licenseNumber_key' AND parent_object_id = OBJECT_ID('dbo.Driver'))
  ALTER TABLE [dbo].[Driver] DROP CONSTRAINT [Driver_licenseNumber_key];

DROP INDEX IF EXISTS [Driver_tenantId_idx] ON [dbo].[Driver];

ALTER TABLE [dbo].[Driver] ALTER COLUMN [tenantId] NVARCHAR(36) NOT NULL;
ALTER TABLE [dbo].[Driver] ALTER COLUMN [licenseNumber] NVARCHAR(64) NOT NULL;

CREATE NONCLUSTERED INDEX [Driver_tenantId_idx] ON [dbo].[Driver]([tenantId]);

ALTER TABLE [dbo].[Driver] ADD CONSTRAINT [Driver_tenantId_licenseNumber_key] UNIQUE NONCLUSTERED ([tenantId], [licenseNumber]);

-- ============================================================
-- WorkOrder.woNumber (dependent: WorkOrder_tenantId_idx + 15 composite tenantId,* indexes)
-- ============================================================
IF EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = 'WorkOrder_woNumber_key' AND parent_object_id = OBJECT_ID('dbo.WorkOrder'))
  ALTER TABLE [dbo].[WorkOrder] DROP CONSTRAINT [WorkOrder_woNumber_key];

DROP INDEX IF EXISTS [WorkOrder_tenantId_idx] ON [dbo].[WorkOrder];
DROP INDEX IF EXISTS [WorkOrder_tenantId_status_idx] ON [dbo].[WorkOrder];
DROP INDEX IF EXISTS [WorkOrder_tenantId_createdAt_idx] ON [dbo].[WorkOrder];
DROP INDEX IF EXISTS [WorkOrder_tenantId_updatedAt_idx] ON [dbo].[WorkOrder];
DROP INDEX IF EXISTS [WorkOrder_tenantId_isTriage_idx] ON [dbo].[WorkOrder];
DROP INDEX IF EXISTS [WorkOrder_tenantId_dueDate_idx] ON [dbo].[WorkOrder];
DROP INDEX IF EXISTS [WorkOrder_tenantId_siteId_idx] ON [dbo].[WorkOrder];
DROP INDEX IF EXISTS [WorkOrder_tenantId_functionalLocationId_idx] ON [dbo].[WorkOrder];
DROP INDEX IF EXISTS [WorkOrder_tenantId_assetId_status_idx] ON [dbo].[WorkOrder];
DROP INDEX IF EXISTS [WorkOrder_tenantId_completedDate_idx] ON [dbo].[WorkOrder];
DROP INDEX IF EXISTS [WorkOrder_tenantId_closedAt_idx] ON [dbo].[WorkOrder];
DROP INDEX IF EXISTS [WorkOrder_tenantId_pmPlanId_idx] ON [dbo].[WorkOrder];
DROP INDEX IF EXISTS [WorkOrder_tenantId_pmOccurrenceKey_idx] ON [dbo].[WorkOrder];
DROP INDEX IF EXISTS [WorkOrder_tenantId_vendorSupplierId_idx] ON [dbo].[WorkOrder];
DROP INDEX IF EXISTS [WorkOrder_tenantId_executionMode_idx] ON [dbo].[WorkOrder];
DROP INDEX IF EXISTS [WorkOrder_tenantId_lastIdempotencyKey_idx] ON [dbo].[WorkOrder];

ALTER TABLE [dbo].[WorkOrder] ALTER COLUMN [tenantId] NVARCHAR(36) NOT NULL;
ALTER TABLE [dbo].[WorkOrder] ALTER COLUMN [woNumber] NVARCHAR(64) NOT NULL;

CREATE NONCLUSTERED INDEX [WorkOrder_tenantId_idx] ON [dbo].[WorkOrder]([tenantId]);
CREATE NONCLUSTERED INDEX [WorkOrder_tenantId_status_idx] ON [dbo].[WorkOrder]([tenantId], [status]);
CREATE NONCLUSTERED INDEX [WorkOrder_tenantId_createdAt_idx] ON [dbo].[WorkOrder]([tenantId], [createdAt]);
CREATE NONCLUSTERED INDEX [WorkOrder_tenantId_updatedAt_idx] ON [dbo].[WorkOrder]([tenantId], [updatedAt]);
CREATE NONCLUSTERED INDEX [WorkOrder_tenantId_isTriage_idx] ON [dbo].[WorkOrder]([tenantId], [isTriage]);
CREATE NONCLUSTERED INDEX [WorkOrder_tenantId_dueDate_idx] ON [dbo].[WorkOrder]([tenantId], [dueDate]);
CREATE NONCLUSTERED INDEX [WorkOrder_tenantId_siteId_idx] ON [dbo].[WorkOrder]([tenantId], [siteId]);
CREATE NONCLUSTERED INDEX [WorkOrder_tenantId_functionalLocationId_idx] ON [dbo].[WorkOrder]([tenantId], [functionalLocationId]);
CREATE NONCLUSTERED INDEX [WorkOrder_tenantId_assetId_status_idx] ON [dbo].[WorkOrder]([tenantId], [assetId], [status]);
CREATE NONCLUSTERED INDEX [WorkOrder_tenantId_completedDate_idx] ON [dbo].[WorkOrder]([tenantId], [completedDate]);
CREATE NONCLUSTERED INDEX [WorkOrder_tenantId_closedAt_idx] ON [dbo].[WorkOrder]([tenantId], [closedAt]);
CREATE NONCLUSTERED INDEX [WorkOrder_tenantId_pmPlanId_idx] ON [dbo].[WorkOrder]([tenantId], [pmPlanId]);
CREATE NONCLUSTERED INDEX [WorkOrder_tenantId_pmOccurrenceKey_idx] ON [dbo].[WorkOrder]([tenantId], [pmOccurrenceKey]);
CREATE NONCLUSTERED INDEX [WorkOrder_tenantId_vendorSupplierId_idx] ON [dbo].[WorkOrder]([tenantId], [vendorSupplierId]);
CREATE NONCLUSTERED INDEX [WorkOrder_tenantId_executionMode_idx] ON [dbo].[WorkOrder]([tenantId], [executionMode]);
CREATE NONCLUSTERED INDEX [WorkOrder_tenantId_lastIdempotencyKey_idx] ON [dbo].[WorkOrder]([tenantId], [lastIdempotencyKey]);

ALTER TABLE [dbo].[WorkOrder] ADD CONSTRAINT [WorkOrder_tenantId_woNumber_key] UNIQUE NONCLUSTERED ([tenantId], [woNumber]);

-- ============================================================
-- SparePart.partNumber (dependent: SparePart_tenantId_idx + 4 composite tenantId,* indexes)
-- ============================================================
IF EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = 'SparePart_partNumber_key' AND parent_object_id = OBJECT_ID('dbo.SparePart'))
  ALTER TABLE [dbo].[SparePart] DROP CONSTRAINT [SparePart_partNumber_key];

DROP INDEX IF EXISTS [SparePart_tenantId_idx] ON [dbo].[SparePart];
DROP INDEX IF EXISTS [SparePart_tenantId_isActive_idx] ON [dbo].[SparePart];
DROP INDEX IF EXISTS [SparePart_tenantId_classification_idx] ON [dbo].[SparePart];
DROP INDEX IF EXISTS [SparePart_tenantId_erpCode_idx] ON [dbo].[SparePart];
DROP INDEX IF EXISTS [SparePart_tenantId_criticalSpare_idx] ON [dbo].[SparePart];

ALTER TABLE [dbo].[SparePart] ALTER COLUMN [tenantId] NVARCHAR(36) NOT NULL;
ALTER TABLE [dbo].[SparePart] ALTER COLUMN [partNumber] NVARCHAR(64) NOT NULL;

CREATE NONCLUSTERED INDEX [SparePart_tenantId_idx] ON [dbo].[SparePart]([tenantId]);
CREATE NONCLUSTERED INDEX [SparePart_tenantId_isActive_idx] ON [dbo].[SparePart]([tenantId], [isActive]);
CREATE NONCLUSTERED INDEX [SparePart_tenantId_classification_idx] ON [dbo].[SparePart]([tenantId], [classification]);
CREATE NONCLUSTERED INDEX [SparePart_tenantId_erpCode_idx] ON [dbo].[SparePart]([tenantId], [erpCode]);
CREATE NONCLUSTERED INDEX [SparePart_tenantId_criticalSpare_idx] ON [dbo].[SparePart]([tenantId], [criticalSpare]);

ALTER TABLE [dbo].[SparePart] ADD CONSTRAINT [SparePart_tenantId_partNumber_key] UNIQUE NONCLUSTERED ([tenantId], [partNumber]);

-- ============================================================
-- UtilityMeter.meterNumber (dependent: UtilityMeter_tenantId_idx)
-- ============================================================
IF EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = 'UtilityMeter_meterNumber_key' AND parent_object_id = OBJECT_ID('dbo.UtilityMeter'))
  ALTER TABLE [dbo].[UtilityMeter] DROP CONSTRAINT [UtilityMeter_meterNumber_key];

DROP INDEX IF EXISTS [UtilityMeter_tenantId_idx] ON [dbo].[UtilityMeter];

ALTER TABLE [dbo].[UtilityMeter] ALTER COLUMN [tenantId] NVARCHAR(36) NOT NULL;
ALTER TABLE [dbo].[UtilityMeter] ALTER COLUMN [meterNumber] NVARCHAR(64) NOT NULL;

CREATE NONCLUSTERED INDEX [UtilityMeter_tenantId_idx] ON [dbo].[UtilityMeter]([tenantId]);

ALTER TABLE [dbo].[UtilityMeter] ADD CONSTRAINT [UtilityMeter_tenantId_meterNumber_key] UNIQUE NONCLUSTERED ([tenantId], [meterNumber]);

-- ============================================================
-- AccidentReport.reportNumber (dependent: AccidentReport_tenantId_idx)
-- ============================================================
IF EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = 'AccidentReport_reportNumber_key' AND parent_object_id = OBJECT_ID('dbo.AccidentReport'))
  ALTER TABLE [dbo].[AccidentReport] DROP CONSTRAINT [AccidentReport_reportNumber_key];

DROP INDEX IF EXISTS [AccidentReport_tenantId_idx] ON [dbo].[AccidentReport];

ALTER TABLE [dbo].[AccidentReport] ALTER COLUMN [tenantId] NVARCHAR(36) NOT NULL;
ALTER TABLE [dbo].[AccidentReport] ALTER COLUMN [reportNumber] NVARCHAR(64) NOT NULL;

CREATE NONCLUSTERED INDEX [AccidentReport_tenantId_idx] ON [dbo].[AccidentReport]([tenantId]);

ALTER TABLE [dbo].[AccidentReport] ADD CONSTRAINT [AccidentReport_tenantId_reportNumber_key] UNIQUE NONCLUSTERED ([tenantId], [reportNumber]);

-- ============================================================
-- InsuranceClaim.claimNumber (dependent: InsuranceClaim_tenantId_idx)
-- ============================================================
IF EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = 'InsuranceClaim_claimNumber_key' AND parent_object_id = OBJECT_ID('dbo.InsuranceClaim'))
  ALTER TABLE [dbo].[InsuranceClaim] DROP CONSTRAINT [InsuranceClaim_claimNumber_key];

DROP INDEX IF EXISTS [InsuranceClaim_tenantId_idx] ON [dbo].[InsuranceClaim];

ALTER TABLE [dbo].[InsuranceClaim] ALTER COLUMN [tenantId] NVARCHAR(36) NOT NULL;
ALTER TABLE [dbo].[InsuranceClaim] ALTER COLUMN [claimNumber] NVARCHAR(64) NOT NULL;

CREATE NONCLUSTERED INDEX [InsuranceClaim_tenantId_idx] ON [dbo].[InsuranceClaim]([tenantId]);

ALTER TABLE [dbo].[InsuranceClaim] ADD CONSTRAINT [InsuranceClaim_tenantId_claimNumber_key] UNIQUE NONCLUSTERED ([tenantId], [claimNumber]);

-- ============================================================
-- TrafficFine.fineNumber (dependent: TrafficFine_tenantId_idx)
-- ============================================================
IF EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = 'TrafficFine_fineNumber_key' AND parent_object_id = OBJECT_ID('dbo.TrafficFine'))
  ALTER TABLE [dbo].[TrafficFine] DROP CONSTRAINT [TrafficFine_fineNumber_key];

DROP INDEX IF EXISTS [TrafficFine_tenantId_idx] ON [dbo].[TrafficFine];

ALTER TABLE [dbo].[TrafficFine] ALTER COLUMN [tenantId] NVARCHAR(36) NOT NULL;
ALTER TABLE [dbo].[TrafficFine] ALTER COLUMN [fineNumber] NVARCHAR(64) NOT NULL;

CREATE NONCLUSTERED INDEX [TrafficFine_tenantId_idx] ON [dbo].[TrafficFine]([tenantId]);

ALTER TABLE [dbo].[TrafficFine] ADD CONSTRAINT [TrafficFine_tenantId_fineNumber_key] UNIQUE NONCLUSTERED ([tenantId], [fineNumber]);
