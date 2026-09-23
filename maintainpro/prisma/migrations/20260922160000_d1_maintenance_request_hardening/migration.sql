-- D1: Maintenance Request hardening
-- - vehicleId canonical target (preserves Vehicle on Request→WO conversion)
-- - requester urgency/impact fields (not official Priority)
-- - targetUnresolved + approximateLocation for "Not Sure" intake
-- - originalSubmission immutable snapshot
-- - filtered unique on (tenantId, idempotencyKey) for concurrent create idempotency
--   (plain UNIQUE would allow only one NULL idempotencyKey on SQL Server)

ALTER TABLE [dbo].[MaintenanceRequest] ADD [vehicleId] NVARCHAR(36) NULL;
ALTER TABLE [dbo].[MaintenanceRequest] ADD [targetUnresolved] BIT NOT NULL CONSTRAINT [DF_MaintenanceRequest_targetUnresolved] DEFAULT 0;
ALTER TABLE [dbo].[MaintenanceRequest] ADD [approximateLocation] NVARCHAR(500) NULL;
ALTER TABLE [dbo].[MaintenanceRequest] ADD [reportedUrgency] NVARCHAR(32) NULL;
ALTER TABLE [dbo].[MaintenanceRequest] ADD [safetyImpact] NVARCHAR(32) NULL;
ALTER TABLE [dbo].[MaintenanceRequest] ADD [productionImpact] NVARCHAR(32) NULL;
ALTER TABLE [dbo].[MaintenanceRequest] ADD [originalSubmission] NVARCHAR(MAX) NULL;

IF NOT EXISTS (
  SELECT 1 FROM sys.foreign_keys
  WHERE name = N'MaintenanceRequest_vehicleId_fkey'
    AND parent_object_id = OBJECT_ID(N'dbo.MaintenanceRequest')
)
  ALTER TABLE [dbo].[MaintenanceRequest] WITH CHECK
    ADD CONSTRAINT [MaintenanceRequest_vehicleId_fkey]
    FOREIGN KEY ([vehicleId]) REFERENCES [dbo].[Vehicle]([id])
    ON DELETE NO ACTION ON UPDATE NO ACTION;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'MaintenanceRequest_tenantId_vehicleId_status_idx'
    AND object_id = OBJECT_ID(N'dbo.MaintenanceRequest')
)
  CREATE NONCLUSTERED INDEX [MaintenanceRequest_tenantId_vehicleId_status_idx]
    ON [dbo].[MaintenanceRequest]([tenantId], [vehicleId], [status]);

-- Replace non-unique (tenantId, idempotencyKey) lookup index with filtered unique
IF EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'MaintenanceRequest_tenantId_idempotencyKey_idx'
    AND object_id = OBJECT_ID(N'dbo.MaintenanceRequest')
)
  DROP INDEX [MaintenanceRequest_tenantId_idempotencyKey_idx] ON [dbo].[MaintenanceRequest];

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'MaintenanceRequest_tenantId_idempotencyKey_key'
    AND object_id = OBJECT_ID(N'dbo.MaintenanceRequest')
)
  CREATE UNIQUE NONCLUSTERED INDEX [MaintenanceRequest_tenantId_idempotencyKey_key]
    ON [dbo].[MaintenanceRequest]([tenantId], [idempotencyKey])
    WHERE [idempotencyKey] IS NOT NULL;