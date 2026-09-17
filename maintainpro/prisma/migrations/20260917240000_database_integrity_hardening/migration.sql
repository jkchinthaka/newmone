-- Database integrity hardening (Phase 15)
-- - Tenant-scoped unique (tenantId, id) for composite integrity paths
-- - Required PartRequest.tenantId + Decimal money columns
-- - MeterCorrection / WorkflowVersion FKs
-- - OrganizationUnit + CustomFieldValue
-- - Cross-tenant guard triggers (Prisma cannot composite-FK optional assetId with required tenantId)
-- - Append-only AuditLog / ConfigChangeHistory protections
-- - Reporting view security documentation + tenantId NOT NULL filter

/* ---------- Unique (tenantId, id) supporting indexes ---------- */
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'Asset_tenantId_id_key' AND object_id = OBJECT_ID(N'dbo.Asset'))
  CREATE UNIQUE NONCLUSTERED INDEX [Asset_tenantId_id_key] ON [dbo].[Asset]([tenantId], [id]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'Vehicle_tenantId_id_key' AND object_id = OBJECT_ID(N'dbo.Vehicle'))
  CREATE UNIQUE NONCLUSTERED INDEX [Vehicle_tenantId_id_key] ON [dbo].[Vehicle]([tenantId], [id]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'WorkOrder_tenantId_id_key' AND object_id = OBJECT_ID(N'dbo.WorkOrder'))
  CREATE UNIQUE NONCLUSTERED INDEX [WorkOrder_tenantId_id_key] ON [dbo].[WorkOrder]([tenantId], [id]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'AssetMeter_tenantId_id_key' AND object_id = OBJECT_ID(N'dbo.AssetMeter'))
  CREATE UNIQUE NONCLUSTERED INDEX [AssetMeter_tenantId_id_key] ON [dbo].[AssetMeter]([tenantId], [id]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'WorkflowVersion_tenantId_id_key' AND object_id = OBJECT_ID(N'dbo.WorkflowVersion'))
  CREATE UNIQUE NONCLUSTERED INDEX [WorkflowVersion_tenantId_id_key] ON [dbo].[WorkflowVersion]([tenantId], [id]);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'WorkOrder_tenantId_technicianId_status_idx' AND object_id = OBJECT_ID(N'dbo.WorkOrder'))
  CREATE NONCLUSTERED INDEX [WorkOrder_tenantId_technicianId_status_idx]
    ON [dbo].[WorkOrder]([tenantId], [technicianId], [status]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'WorkOrder_tenantId_workflowVersionId_idx' AND object_id = OBJECT_ID(N'dbo.WorkOrder'))
  CREATE NONCLUSTERED INDEX [WorkOrder_tenantId_workflowVersionId_idx]
    ON [dbo].[WorkOrder]([tenantId], [workflowVersionId]);

/* ---------- PartRequest tenantId required + Decimal cost ---------- */
UPDATE pr
SET pr.[tenantId] = wo.[tenantId]
FROM [dbo].[PartRequest] pr
INNER JOIN [dbo].[WorkOrder] wo ON wo.[id] = pr.[workOrderId]
WHERE pr.[tenantId] IS NULL;

-- Orphan part requests without WO tenant: cannot remain nullable for integrity
DELETE FROM [dbo].[PartRequest] WHERE [tenantId] IS NULL;

-- Drop dependent indexes before ALTER COLUMN
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'PartRequest_tenantId_idx' AND object_id = OBJECT_ID(N'dbo.PartRequest'))
  DROP INDEX [PartRequest_tenantId_idx] ON [dbo].[PartRequest];
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'PartRequest_tenantId_status_idx' AND object_id = OBJECT_ID(N'dbo.PartRequest'))
  DROP INDEX [PartRequest_tenantId_status_idx] ON [dbo].[PartRequest];

IF EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID(N'dbo.PartRequest') AND name = N'tenantId' AND is_nullable = 1
)
BEGIN
  ALTER TABLE [dbo].[PartRequest] ALTER COLUMN [tenantId] NVARCHAR(36) NOT NULL;
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'PartRequest_tenantId_idx' AND object_id = OBJECT_ID(N'dbo.PartRequest'))
  CREATE NONCLUSTERED INDEX [PartRequest_tenantId_idx] ON [dbo].[PartRequest]([tenantId]);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'PartRequest_tenantId_status_idx' AND object_id = OBJECT_ID(N'dbo.PartRequest'))
  CREATE NONCLUSTERED INDEX [PartRequest_tenantId_status_idx] ON [dbo].[PartRequest]([tenantId], [status]);

-- Decimal conversions: drop indexes that depend on money columns when needed
IF COL_LENGTH(N'dbo.PartRequest', N'unitCostSnapshot') IS NOT NULL
BEGIN
  DECLARE @prCostSql NVARCHAR(MAX) = N'ALTER TABLE [dbo].[PartRequest] ALTER COLUMN [unitCostSnapshot] DECIMAL(18,2) NOT NULL';
  EXEC(@prCostSql);
END;

IF COL_LENGTH(N'dbo.PartIssue', N'unitCostSnapshot') IS NOT NULL
BEGIN
  DECLARE @piCostSql NVARCHAR(MAX) = N'ALTER TABLE [dbo].[PartIssue] ALTER COLUMN [unitCostSnapshot] DECIMAL(18,2) NULL';
  EXEC(@piCostSql);
END;

IF COL_LENGTH(N'dbo.VendorQuotation', N'quotedAmount') IS NOT NULL
  EXEC(N'ALTER TABLE [dbo].[VendorQuotation] ALTER COLUMN [quotedAmount] DECIMAL(18,2) NOT NULL');
IF COL_LENGTH(N'dbo.VendorRepairCase', N'approvedQuotationAmount') IS NOT NULL
  EXEC(N'ALTER TABLE [dbo].[VendorRepairCase] ALTER COLUMN [approvedQuotationAmount] DECIMAL(18,2) NULL');
IF COL_LENGTH(N'dbo.Asset', N'purchasePrice') IS NOT NULL
  EXEC(N'ALTER TABLE [dbo].[Asset] ALTER COLUMN [purchasePrice] DECIMAL(18,2) NULL');
IF COL_LENGTH(N'dbo.Asset', N'currentValue') IS NOT NULL
  EXEC(N'ALTER TABLE [dbo].[Asset] ALTER COLUMN [currentValue] DECIMAL(18,2) NULL');
IF COL_LENGTH(N'dbo.Vehicle', N'purchasePrice') IS NOT NULL
  EXEC(N'ALTER TABLE [dbo].[Vehicle] ALTER COLUMN [purchasePrice] DECIMAL(18,2) NULL');
IF COL_LENGTH(N'dbo.Vehicle', N'currentValue') IS NOT NULL
  EXEC(N'ALTER TABLE [dbo].[Vehicle] ALTER COLUMN [currentValue] DECIMAL(18,2) NULL');
IF COL_LENGTH(N'dbo.InsuranceClaim', N'claimAmount') IS NOT NULL
  EXEC(N'ALTER TABLE [dbo].[InsuranceClaim] ALTER COLUMN [claimAmount] DECIMAL(18,2) NOT NULL');
IF COL_LENGTH(N'dbo.InsuranceClaim', N'approvedAmount') IS NOT NULL
  EXEC(N'ALTER TABLE [dbo].[InsuranceClaim] ALTER COLUMN [approvedAmount] DECIMAL(18,2) NULL');
IF COL_LENGTH(N'dbo.AccidentReport', N'estimatedDamageCost') IS NOT NULL
  EXEC(N'ALTER TABLE [dbo].[AccidentReport] ALTER COLUMN [estimatedDamageCost] DECIMAL(18,2) NULL');
IF COL_LENGTH(N'dbo.AccidentReport', N'actualDamageCost') IS NOT NULL
  EXEC(N'ALTER TABLE [dbo].[AccidentReport] ALTER COLUMN [actualDamageCost] DECIMAL(18,2) NULL');
IF COL_LENGTH(N'dbo.TrafficFine', N'fineAmount') IS NOT NULL
  EXEC(N'ALTER TABLE [dbo].[TrafficFine] ALTER COLUMN [fineAmount] DECIMAL(18,2) NOT NULL');
IF COL_LENGTH(N'dbo.TrafficFine', N'paidAmount') IS NOT NULL
  EXEC(N'ALTER TABLE [dbo].[TrafficFine] ALTER COLUMN [paidAmount] DECIMAL(18,2) NULL');
IF COL_LENGTH(N'dbo.BudgetCommitment', N'amount') IS NOT NULL
  EXEC(N'ALTER TABLE [dbo].[BudgetCommitment] ALTER COLUMN [amount] DECIMAL(18,2) NOT NULL');

/* ---------- MeterCorrection FK ---------- */
IF OBJECT_ID(N'dbo.MeterCorrection', N'U') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'MeterCorrection_meterId_fkey')
BEGIN
  -- Drop orphan corrections that cannot be linked
  DELETE mc
  FROM [dbo].[MeterCorrection] mc
  WHERE NOT EXISTS (SELECT 1 FROM [dbo].[AssetMeter] am WHERE am.[id] = mc.[meterId]);

  ALTER TABLE [dbo].[MeterCorrection]
    ADD CONSTRAINT [MeterCorrection_meterId_fkey]
    FOREIGN KEY ([meterId]) REFERENCES [dbo].[AssetMeter]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'MeterCorrection_tenantId_meterId_idx' AND object_id = OBJECT_ID(N'dbo.MeterCorrection'))
  CREATE NONCLUSTERED INDEX [MeterCorrection_tenantId_meterId_idx]
    ON [dbo].[MeterCorrection]([tenantId], [meterId]);

/* ---------- WorkOrder → WorkflowVersion FK ---------- */
IF COL_LENGTH(N'dbo.WorkOrder', N'workflowVersionId') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'WorkOrder_workflowVersionId_fkey')
BEGIN
  UPDATE wo SET wo.[workflowVersionId] = NULL
  FROM [dbo].[WorkOrder] wo
  WHERE wo.[workflowVersionId] IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM [dbo].[WorkflowVersion] wv WHERE wv.[id] = wo.[workflowVersionId]);

  ALTER TABLE [dbo].[WorkOrder]
    ADD CONSTRAINT [WorkOrder_workflowVersionId_fkey]
    FOREIGN KEY ([workflowVersionId]) REFERENCES [dbo].[WorkflowVersion]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
END;

/* ---------- OrganizationUnit ---------- */
IF OBJECT_ID(N'dbo.OrganizationUnit', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[OrganizationUnit] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [parentId] NVARCHAR(36) NULL,
    [code] NVARCHAR(64) NOT NULL,
    [name] NVARCHAR(200) NOT NULL,
    [unitType] NVARCHAR(32) NOT NULL,
    [siteId] NVARCHAR(36) NULL,
    [departmentId] NVARCHAR(36) NULL,
    [status] NVARCHAR(32) NOT NULL CONSTRAINT [OrganizationUnit_status_df] DEFAULT N'ACTIVE',
    [effectiveFrom] DATETIME2 NULL,
    [effectiveTo] DATETIME2 NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [OrganizationUnit_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [OrganizationUnit_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [OrganizationUnit_tenantId_code_key] UNIQUE NONCLUSTERED ([tenantId], [code]),
    CONSTRAINT [OrganizationUnit_tenantId_id_key] UNIQUE NONCLUSTERED ([tenantId], [id])
  );
  CREATE INDEX [OrganizationUnit_tenantId_status_idx] ON [dbo].[OrganizationUnit]([tenantId], [status]);
  CREATE INDEX [OrganizationUnit_tenantId_parentId_idx] ON [dbo].[OrganizationUnit]([tenantId], [parentId]);
  CREATE INDEX [OrganizationUnit_tenantId_unitType_idx] ON [dbo].[OrganizationUnit]([tenantId], [unitType]);
  ALTER TABLE [dbo].[OrganizationUnit]
    ADD CONSTRAINT [OrganizationUnit_tenantId_fkey]
    FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
  ALTER TABLE [dbo].[OrganizationUnit]
    ADD CONSTRAINT [OrganizationUnit_parentId_fkey]
    FOREIGN KEY ([parentId]) REFERENCES [dbo].[OrganizationUnit]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
END;

/* ---------- CustomFieldValue ---------- */
IF OBJECT_ID(N'dbo.CustomFieldValue', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[CustomFieldValue] (
    [id] NVARCHAR(36) NOT NULL,
    [tenantId] NVARCHAR(36) NOT NULL,
    [definitionId] NVARCHAR(36) NOT NULL,
    [entityType] NVARCHAR(64) NOT NULL,
    [entityId] NVARCHAR(36) NOT NULL,
    [valueText] NVARCHAR(Max) NULL,
    [valueNumber] DECIMAL(18,4) NULL,
    [valueBool] BIT NULL,
    [valueDate] DATETIME2 NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [CustomFieldValue_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [CustomFieldValue_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [CustomFieldValue_tenant_def_entity_key]
      UNIQUE NONCLUSTERED ([tenantId], [definitionId], [entityType], [entityId])
  );
  CREATE INDEX [CustomFieldValue_tenant_entity_idx]
    ON [dbo].[CustomFieldValue]([tenantId], [entityType], [entityId]);
  ALTER TABLE [dbo].[CustomFieldValue]
    ADD CONSTRAINT [CustomFieldValue_tenantId_fkey]
    FOREIGN KEY ([tenantId]) REFERENCES [dbo].[Tenant]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
  ALTER TABLE [dbo].[CustomFieldValue]
    ADD CONSTRAINT [CustomFieldValue_definitionId_fkey]
    FOREIGN KEY ([definitionId]) REFERENCES [dbo].[CustomFieldDefinition]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;
END;

/* ---------- Cross-tenant guard triggers ---------- */
IF OBJECT_ID(N'dbo.trg_WorkOrder_tenant_refs', N'TR') IS NOT NULL DROP TRIGGER [dbo].[trg_WorkOrder_tenant_refs];
EXEC(N'
CREATE TRIGGER [dbo].[trg_WorkOrder_tenant_refs]
ON [dbo].[WorkOrder]
AFTER INSERT, UPDATE
AS
BEGIN
  SET NOCOUNT ON;
  IF EXISTS (
    SELECT 1 FROM inserted i
    INNER JOIN [dbo].[Asset] a ON a.[id] = i.[assetId]
    WHERE i.[assetId] IS NOT NULL AND a.[tenantId] <> i.[tenantId]
  )
  BEGIN
    THROW 50001, N''CROSS_TENANT_FK: WorkOrder.assetId belongs to another tenant'', 1;
    ROLLBACK TRANSACTION;
    RETURN;
  END;
  IF EXISTS (
    SELECT 1 FROM inserted i
    INNER JOIN [dbo].[Vehicle] v ON v.[id] = i.[vehicleId]
    WHERE i.[vehicleId] IS NOT NULL AND v.[tenantId] <> i.[tenantId]
  )
  BEGIN
    THROW 50002, N''CROSS_TENANT_FK: WorkOrder.vehicleId belongs to another tenant'', 1;
    ROLLBACK TRANSACTION;
    RETURN;
  END;
  IF EXISTS (
    SELECT 1 FROM inserted i
    INNER JOIN [dbo].[WorkflowVersion] wv ON wv.[id] = i.[workflowVersionId]
    WHERE i.[workflowVersionId] IS NOT NULL AND wv.[tenantId] <> i.[tenantId]
  )
  BEGIN
    THROW 50003, N''CROSS_TENANT_FK: WorkOrder.workflowVersionId belongs to another tenant'', 1;
    ROLLBACK TRANSACTION;
    RETURN;
  END;
END
');

IF OBJECT_ID(N'dbo.trg_MaintenanceRequest_tenant_asset', N'TR') IS NOT NULL
  DROP TRIGGER [dbo].[trg_MaintenanceRequest_tenant_asset];
EXEC(N'
CREATE TRIGGER [dbo].[trg_MaintenanceRequest_tenant_asset]
ON [dbo].[MaintenanceRequest]
AFTER INSERT, UPDATE
AS
BEGIN
  SET NOCOUNT ON;
  IF EXISTS (
    SELECT 1 FROM inserted i
    INNER JOIN [dbo].[Asset] a ON a.[id] = i.[assetId]
    WHERE i.[assetId] IS NOT NULL AND a.[tenantId] <> i.[tenantId]
  )
  BEGIN
    THROW 50004, N''CROSS_TENANT_FK: MaintenanceRequest.assetId belongs to another tenant'', 1;
    ROLLBACK TRANSACTION;
    RETURN;
  END;
END
');

IF OBJECT_ID(N'dbo.trg_MeterCorrection_tenant_meter', N'TR') IS NOT NULL
  DROP TRIGGER [dbo].[trg_MeterCorrection_tenant_meter];
EXEC(N'
CREATE TRIGGER [dbo].[trg_MeterCorrection_tenant_meter]
ON [dbo].[MeterCorrection]
AFTER INSERT, UPDATE
AS
BEGIN
  SET NOCOUNT ON;
  IF EXISTS (
    SELECT 1 FROM inserted i
    INNER JOIN [dbo].[AssetMeter] m ON m.[id] = i.[meterId]
    WHERE m.[tenantId] <> i.[tenantId]
  )
  BEGIN
    THROW 50005, N''CROSS_TENANT_FK: MeterCorrection.meterId belongs to another tenant'', 1;
    ROLLBACK TRANSACTION;
    RETURN;
  END;
END
');

IF OBJECT_ID(N'dbo.trg_PartRequest_tenant_wo', N'TR') IS NOT NULL
  DROP TRIGGER [dbo].[trg_PartRequest_tenant_wo];
EXEC(N'
CREATE TRIGGER [dbo].[trg_PartRequest_tenant_wo]
ON [dbo].[PartRequest]
AFTER INSERT, UPDATE
AS
BEGIN
  SET NOCOUNT ON;
  IF EXISTS (
    SELECT 1 FROM inserted i
    INNER JOIN [dbo].[WorkOrder] wo ON wo.[id] = i.[workOrderId]
    WHERE wo.[tenantId] <> i.[tenantId]
  )
  BEGIN
    THROW 50006, N''CROSS_TENANT_FK: PartRequest.workOrderId belongs to another tenant'', 1;
    ROLLBACK TRANSACTION;
    RETURN;
  END;
END
');

IF OBJECT_ID(N'dbo.trg_OrganizationUnit_tenant_parent', N'TR') IS NOT NULL
  DROP TRIGGER [dbo].[trg_OrganizationUnit_tenant_parent];
EXEC(N'
CREATE TRIGGER [dbo].[trg_OrganizationUnit_tenant_parent]
ON [dbo].[OrganizationUnit]
AFTER INSERT, UPDATE
AS
BEGIN
  SET NOCOUNT ON;
  IF EXISTS (
    SELECT 1 FROM inserted i
    INNER JOIN [dbo].[OrganizationUnit] p ON p.[id] = i.[parentId]
    WHERE i.[parentId] IS NOT NULL AND p.[tenantId] <> i.[tenantId]
  )
  BEGIN
    THROW 50007, N''CROSS_TENANT_FK: OrganizationUnit.parentId belongs to another tenant'', 1;
    ROLLBACK TRANSACTION;
    RETURN;
  END;
  IF EXISTS (SELECT 1 FROM inserted i WHERE i.[parentId] IS NOT NULL AND i.[parentId] = i.[id])
  BEGIN
    THROW 50008, N''ORG_CYCLE: OrganizationUnit cannot be its own parent'', 1;
    ROLLBACK TRANSACTION;
    RETURN;
  END;
END
');

/* ---------- Audit immutability ---------- */
IF OBJECT_ID(N'dbo.trg_AuditLog_immutable', N'TR') IS NOT NULL DROP TRIGGER [dbo].[trg_AuditLog_immutable];
EXEC(N'
CREATE TRIGGER [dbo].[trg_AuditLog_immutable]
ON [dbo].[AuditLog]
AFTER UPDATE, DELETE
AS
BEGIN
  SET NOCOUNT ON;
  THROW 50010, N''AUDIT_IMMUTABLE: AuditLog rows cannot be updated or deleted'', 1;
  ROLLBACK TRANSACTION;
END
');

IF OBJECT_ID(N'dbo.trg_ConfigChangeHistory_immutable', N'TR') IS NOT NULL
  DROP TRIGGER [dbo].[trg_ConfigChangeHistory_immutable];
EXEC(N'
CREATE TRIGGER [dbo].[trg_ConfigChangeHistory_immutable]
ON [dbo].[ConfigChangeHistory]
AFTER UPDATE, DELETE
AS
BEGIN
  SET NOCOUNT ON;
  THROW 50011, N''AUDIT_IMMUTABLE: ConfigChangeHistory rows cannot be updated or deleted'', 1;
  ROLLBACK TRANSACTION;
END
');

/* ---------- Reporting views: document tenant filter requirement ---------- */
IF OBJECT_ID(N'dbo.vw_rpt_fact_maintenance', N'V') IS NOT NULL
  EXEC(N'DROP VIEW [dbo].[vw_rpt_fact_maintenance]');
EXEC(N'
CREATE VIEW [dbo].[vw_rpt_fact_maintenance] AS
SELECT
  w.[id] AS workOrderId,
  w.[tenantId],
  w.[woNumber],
  w.[status],
  w.[priority],
  w.[type],
  w.[jobDomain],
  w.[assetId],
  w.[vehicleId],
  w.[siteId],
  w.[createdAt],
  w.[completedDate] AS [completedAt],
  w.[actualCost],
  w.[actualHours],
  w.[repeatFailureCandidate]
FROM [dbo].[WorkOrder] w
WHERE w.[tenantId] IS NOT NULL
');

IF OBJECT_ID(N'dbo.vw_rpt_fact_downtime', N'V') IS NOT NULL
  EXEC(N'DROP VIEW [dbo].[vw_rpt_fact_downtime]');
EXEC(N'
CREATE VIEW [dbo].[vw_rpt_fact_downtime] AS
SELECT
  d.[id] AS segmentId,
  d.[tenantId],
  d.[workOrderId],
  d.[assetId],
  d.[category],
  d.[planned],
  d.[startedAt],
  d.[endedAt],
  d.[productionAffected],
  d.[estimatedLostHours]
FROM [dbo].[DowntimeSegment] d
WHERE d.[tenantId] IS NOT NULL
');

IF OBJECT_ID(N'dbo.vw_rpt_dim_branch_site', N'V') IS NOT NULL
  EXEC(N'DROP VIEW [dbo].[vw_rpt_dim_branch_site]');
EXEC(N'
CREATE VIEW [dbo].[vw_rpt_dim_branch_site] AS
SELECT
  s.[id] AS siteId,
  s.[tenantId],
  s.[code] AS siteCode,
  s.[name] AS siteName,
  ou.[id] AS organizationUnitId,
  ou.[code] AS organizationUnitCode,
  ou.[unitType] AS organizationUnitType
FROM [dbo].[Site] s
LEFT JOIN [dbo].[OrganizationUnit] ou
  ON ou.[siteId] = s.[id] AND ou.[tenantId] = s.[tenantId] AND ou.[status] = N''ACTIVE''
WHERE s.[tenantId] IS NOT NULL
');
